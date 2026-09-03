import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IDeviceStateRepository } from 'domain/device-monitoring/repository';
import { IDeviceNotificationPolicyRepository } from 'domain/notifications/repository';
import { ILogger } from 'application/shared/interfaces';
import { SendDeviceDownAlertUseCase } from './SendDeviceDownAlertUseCase';

// Scans every device currently DOWN and opens the down alert for any that
// has been down for at least its effective alert delay — the per-device
// override on DeviceNotificationPolicy if one is set, otherwise
// defaultAlertDelayMs. Independent of any device's own poll interval — a
// device polled once a day would otherwise wait a day for its alert to
// reconsider. SendDeviceDownAlertUseCase already dedupes against an
// existing open alert, so re-selecting a device on every scan is safe.
export class RaiseOverdueDeviceDownAlertsUseCase {
  constructor(
    private readonly deviceStateRepository: IDeviceStateRepository,
    private readonly policyRepository: IDeviceNotificationPolicyRepository,
    private readonly sendDeviceDownAlertUseCase: SendDeviceDownAlertUseCase,
    private readonly defaultAlertDelayMs: number,
    private readonly logger: ILogger
  ) {}

  async execute(): Promise<Result<number>> {
    const downResult = await this.deviceStateRepository.findAllDown();
    if (downResult.isFailure) {
      return Result.fail(
        `Failed to load down devices: ${downResult.error}`
      );
    }

    const now = Date.now();
    let raised = 0;
    for (const state of downResult.value) {
      if (state.downSince === null) continue;

      const delayMs = await this.effectiveAlertDelayMs(
        state.deviceId
      );
      if (now - state.downSince.getTime() < delayMs) continue;

      const result = await this.sendDeviceDownAlertUseCase.execute({
        deviceId: state.deviceId.toString(),
        consecutiveFailures: state.consecutiveFailures,
        occurredAt: new Date()
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

  private async effectiveAlertDelayMs(
    deviceId: DeviceId
  ): Promise<number> {
    const policyResult =
      await this.policyRepository.findByDeviceId(deviceId);
    if (policyResult.isFailure || !policyResult.value) {
      return this.defaultAlertDelayMs;
    }

    return policyResult.value.effectiveAlertDelayMs(
      this.defaultAlertDelayMs
    );
  }
}
