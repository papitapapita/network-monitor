import { Result } from 'domain/shared/core';
import { IDeviceStateRepository } from 'domain/device-monitoring/repository';
import { ILogger } from 'application/shared/interfaces';
import { SendDeviceDownAlertUseCase } from './SendDeviceDownAlertUseCase';

// Scans for devices continuously DOWN for at least alertDelayMs and opens
// their down alert. Independent of any device's own poll interval — a
// device polled once a day would otherwise wait a day for its alert to
// reconsider. SendDeviceDownAlertUseCase already dedupes against an
// existing open alert, so re-selecting a device on every scan is safe.
export class RaiseOverdueDeviceDownAlertsUseCase {
  constructor(
    private readonly deviceStateRepository: IDeviceStateRepository,
    private readonly sendDeviceDownAlertUseCase: SendDeviceDownAlertUseCase,
    private readonly alertDelayMs: number,
    private readonly logger: ILogger
  ) {}

  async execute(): Promise<Result<number>> {
    const cutoff = new Date(Date.now() - this.alertDelayMs);
    const overdueResult =
      await this.deviceStateRepository.findOverdueDown(cutoff);
    if (overdueResult.isFailure) {
      return Result.fail(
        `Failed to load overdue-down devices: ${overdueResult.error}`
      );
    }

    let raised = 0;
    for (const state of overdueResult.value) {
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
}
