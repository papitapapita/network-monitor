import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { AlertSeverity } from 'domain/shared/enums';
import { DeviceState } from 'domain/device-monitoring/aggregates';
import { Alert, OutageAttribution } from 'domain/notifications';
import { IDeviceStateRepository } from 'domain/device-monitoring/repository';
import {
  IAlertRepository,
  IDeviceNotificationPolicyRepository,
  INotificationSettingsRepository
} from 'domain/notifications/repository';
import {
  IAgentStatusQuery,
  ILogger
} from 'application/shared/interfaces';
import { IOutageTopologyQuery } from '../interfaces';
import { SendDeviceDownAlertUseCase } from './SendDeviceDownAlertUseCase';

const ALERT_TYPE = 'device_unreachable';

// Scans every device currently DOWN and opens the down alert for any that
// has been down for at least its effective alert delay — the per-device
// override on DeviceNotificationPolicy if one is set, otherwise the install's
// down-alert delay (NOT-201), read on every scan. Independent of any device's own poll interval — a
// device polled once a day would otherwise wait a day for its alert to
// reconsider. SendDeviceDownAlertUseCase already dedupes against an
// existing open alert, so re-selecting a device on every scan is safe.
//
// A device behind an agent that is not reporting is skipped (ADR 0002, R7):
// its DOWN is the last thing the agent saw, not what is true now. It alerts
// normally once the agent is back and still finds it down.
//
// A device down behind a device that is also down is not paged on its own:
// its alert joins the upstream's (NOT-240..245, OutageAttribution).
export class RaiseOverdueDeviceDownAlertsUseCase {
  constructor(
    private readonly deviceStateRepository: IDeviceStateRepository,
    private readonly policyRepository: IDeviceNotificationPolicyRepository,
    private readonly sendDeviceDownAlertUseCase: SendDeviceDownAlertUseCase,
    private readonly settingsRepository: INotificationSettingsRepository,
    private readonly logger: ILogger,
    private readonly agentStatusQuery: IAgentStatusQuery,
    private readonly alertRepository: IAlertRepository,
    private readonly topology: IOutageTopologyQuery
  ) {}

  async execute(): Promise<Result<number>> {
    const downResult = await this.deviceStateRepository.findAllDown();
    if (downResult.isFailure) {
      return Result.fail(
        `Failed to load down devices: ${downResult.error}`
      );
    }

    const settingsResult = await this.settingsRepository.get();
    if (settingsResult.isFailure) {
      return Result.fail(
        `Failed to load notification settings: ${settingsResult.error}`
      );
    }
    const defaultAlertDelayMs = settingsResult.value.downAlertDelayMs;

    const unmeasuredResult =
      await this.agentStatusQuery.findUnmeasuredDevices(
        downResult.value.map((s) => s.deviceId.toString())
      );
    if (unmeasuredResult.isFailure) {
      return Result.fail(
        `Failed to read agent status: ${unmeasuredResult.error}`
      );
    }
    const unmeasured = unmeasuredResult.value;
    const measuredDown = new Set(
      downResult.value
        .map((s) => s.deviceId.toString())
        .filter((id) => !unmeasured.has(id))
    );

    const now = Date.now();
    let raised = 0;
    for (const state of downResult.value) {
      if (state.downSince === null) continue;
      if (unmeasured.has(state.deviceId.toString())) continue;

      const delayMs = await this.effectiveAlertDelayMs(
        state.deviceId,
        defaultAlertDelayMs
      );
      if (now - state.downSince.getTime() < delayMs) continue;

      const current = await this.stillInSameDownStreak(state);
      if (current === null) continue;

      const handled = await this.attributedUpstream(
        state.deviceId,
        measuredDown,
        delayMs,
        new Date(now)
      );
      if (handled) continue;

      const result = await this.sendDeviceDownAlertUseCase.execute({
        deviceId: current.deviceId.toString(),
        consecutiveFailures: current.consecutiveFailures,
        occurredAt: state.downSince
      });

      if (result.isFailure) {
        this.logger.error(
          'RaiseOverdueDeviceDownAlertsUseCase: failed to raise alert for device',
          undefined,
          { deviceId: state.deviceId.toString(), error: result.error }
        );
        continue;
      }
      if (result.value !== null) raised++;
    }

    return Result.ok(raised);
  }

  // The down list is read once, then walked one device at a time with a
  // publish per alert — long enough on a bad night for a device near the end
  // to have recovered, and its recovery to have closed its alert, before the
  // scan reaches it. Raising off the snapshot then opens a fresh alert for a
  // device that is up, which nothing would ever close (NOT-229). Re-read just
  // before raising; a different downSince is a new streak the next scan
  // judges on its own delay.
  private async stillInSameDownStreak(
    snapshot: DeviceState
  ): Promise<DeviceState | null> {
    const result = await this.deviceStateRepository.findByDeviceId(
      snapshot.deviceId
    );
    if (result.isFailure) {
      this.logger.warn(
        'RaiseOverdueDeviceDownAlertsUseCase: could not re-read device state, skipping until the next scan',
        {
          deviceId: snapshot.deviceId.toString(),
          error: result.error
        }
      );
      return null;
    }

    const current = result.value;
    if (
      current === null ||
      !current.status.isDown() ||
      current.downSince?.getTime() !== snapshot.downSince?.getTime()
    ) {
      return null;
    }
    return current;
  }

  // True when the outage belongs to an upstream device, and so is not paged
  // here. A failed read of the device's own alert or its chain pages — a
  // stray page is cheaper than a missed outage; once an upstream is known to
  // be involved, a failed read holds until the next scan instead.
  private async attributedUpstream(
    deviceId: DeviceId,
    measuredDown: Set<string>,
    delayMs: number,
    now: Date
  ): Promise<boolean> {
    const ownResult =
      await this.alertRepository.findOpenByDeviceAndType(
        deviceId,
        ALERT_TYPE
      );
    if (ownResult.isFailure) {
      this.warnUnattributed(deviceId, ownResult.error);
      return false;
    }
    const own = ownResult.value;
    if (own !== null && own.notifiedAt !== null) return false;

    if (own !== null && own.causedByAlertId !== null) {
      const causeResult = await this.alertRepository.findById(
        own.causedByAlertId
      );
      if (causeResult.isFailure) {
        this.warnUnattributed(deviceId, causeResult.error);
        return true;
      }
      if (
        OutageAttribution.stillHeld(causeResult.value, now, delayMs)
      ) {
        return true;
      }
      own.detachFromCause();
      await this.saveAlert(own);
    }

    const upstreamResult = await this.topology.findUpstreamIds(
      deviceId.toString()
    );
    if (upstreamResult.isFailure) {
      this.warnUnattributed(deviceId, upstreamResult.error);
      return false;
    }

    const rootId = OutageAttribution.rootCause(
      upstreamResult.value.map((id) => ({
        deviceId: id,
        down: measuredDown.has(id)
      }))
    );
    let rootAlert: Alert | null = null;
    if (rootId !== null) {
      const rootDeviceId = DeviceId.parse(rootId);
      if (rootDeviceId.isFailure) return false;
      const rootResult =
        await this.alertRepository.findOpenByDeviceAndType(
          rootDeviceId.value,
          ALERT_TYPE
        );
      if (rootResult.isFailure) {
        this.warnUnattributed(deviceId, rootResult.error);
        return true;
      }
      rootAlert = rootResult.value;
    }

    const decision = OutageAttribution.decide(rootId, rootAlert);
    if (decision.kind === 'ALERT_SELF') return false;
    if (decision.kind === 'WAIT') return true;

    const affected = own ?? this.openRecord(deviceId);
    if (affected === null) return true;
    if (affected.attachTo(decision.causeId).isSuccess) {
      await this.saveAlert(affected);
    }
    return true;
  }

  // The record opens on the transition (NOT-097); this covers the rare
  // device whose transition was never recorded, so it still shows under the
  // root.
  private openRecord(deviceId: DeviceId): Alert | null {
    const result = Alert.open(
      deviceId,
      AlertSeverity.CRITICAL,
      'Disponibilidad',
      ALERT_TYPE,
      'Sin conexión.'
    );
    return result.isSuccess ? result.value : null;
  }

  private async saveAlert(alert: Alert): Promise<void> {
    const result = await this.alertRepository.save(alert);
    if (result.isFailure) {
      this.logger.error(
        'RaiseOverdueDeviceDownAlertsUseCase: failed to save an attributed alert',
        undefined,
        { alertId: alert.id.toString(), error: result.error }
      );
    }
  }

  private warnUnattributed(deviceId: DeviceId, error: string): void {
    this.logger.warn(
      'RaiseOverdueDeviceDownAlertsUseCase: could not check the upstream outage',
      { deviceId: deviceId.toString(), error }
    );
  }

  private async effectiveAlertDelayMs(
    deviceId: DeviceId,
    defaultAlertDelayMs: number
  ): Promise<number> {
    const policyResult =
      await this.policyRepository.findByDeviceId(deviceId);
    if (policyResult.isFailure || !policyResult.value) {
      return defaultAlertDelayMs;
    }

    return policyResult.value.effectiveAlertDelayMs(
      defaultAlertDelayMs
    );
  }
}
