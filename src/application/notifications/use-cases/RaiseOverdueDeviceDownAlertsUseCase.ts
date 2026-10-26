import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { DeviceState } from 'domain/device-monitoring/aggregates';
import { IDeviceStateRepository } from 'domain/device-monitoring/repository';
import {
  IDeviceNotificationPolicyRepository,
  INotificationSettingsRepository
} from 'domain/notifications/repository';
import {
  IAgentStatusQuery,
  ILogger
} from 'application/shared/interfaces';
import { SendDeviceDownAlertUseCase } from './SendDeviceDownAlertUseCase';

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
export class RaiseOverdueDeviceDownAlertsUseCase {
  constructor(
    private readonly deviceStateRepository: IDeviceStateRepository,
    private readonly policyRepository: IDeviceNotificationPolicyRepository,
    private readonly sendDeviceDownAlertUseCase: SendDeviceDownAlertUseCase,
    private readonly settingsRepository: INotificationSettingsRepository,
    private readonly logger: ILogger,
    private readonly agentStatusQuery: IAgentStatusQuery
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
