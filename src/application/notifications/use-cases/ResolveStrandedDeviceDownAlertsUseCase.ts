import { Result } from 'domain/shared/core';
import { IAlertRepository } from 'domain/notifications/repository';
import { IDeviceStateRepository } from 'domain/device-monitoring/repository';
import { ILogger } from 'application/shared/interfaces';

const ALERT_TYPE = 'device_unreachable';

// A down alert is closed by the device's next DeviceCameOnlineEvent, but the
// open and the close run on separate fire-and-forget paths: an open still in
// flight when the device recovers, or a scan that raised one off a stale
// snapshot, leaves an alert open for a device that is answering. Nothing
// else would ever close it, and the next outage would reuse it — reporting
// the device down since the day it was stranded (NOT-229). This sweeps those
// up: any open down alert whose device has answered since it opened.
//
// Closed without notifying, like a suspended device's (see
// SuspendDeviceMonitoringUseCase): the recovery may be minutes or days old,
// and announcing it now would read as news that is not.
export class ResolveStrandedDeviceDownAlertsUseCase {
  constructor(
    private readonly alertRepository: IAlertRepository,
    private readonly deviceStateRepository: IDeviceStateRepository,
    private readonly logger: ILogger
  ) {}

  async execute(): Promise<Result<number>> {
    const openResult =
      await this.alertRepository.findAllOpenByType(ALERT_TYPE);
    if (openResult.isFailure) {
      return Result.fail(
        `Failed to load open down alerts: ${openResult.error}`
      );
    }

    const now = new Date();
    let resolved = 0;
    for (const alert of openResult.value) {
      const stateResult =
        await this.deviceStateRepository.findByDeviceId(
          alert.deviceId
        );
      if (stateResult.isFailure) {
        this.logger.error(
          'ResolveStrandedDeviceDownAlertsUseCase: failed to load device state',
          undefined,
          {
            deviceId: alert.deviceId.toString(),
            error: stateResult.error
          }
        );
        continue;
      }

      const state = stateResult.value;
      const answeredSinceOpened =
        state !== null &&
        state.isOnline &&
        state.lastSeen !== null &&
        state.lastSeen.getTime() > alert.startedAt.getTime();
      if (!answeredSinceOpened) continue;

      if (alert.resolve(now).isFailure) continue;
      const saveResult = await this.alertRepository.save(alert);
      if (saveResult.isFailure) {
        this.logger.error(
          'ResolveStrandedDeviceDownAlertsUseCase: failed to save alert',
          undefined,
          {
            deviceId: alert.deviceId.toString(),
            error: saveResult.error
          }
        );
        continue;
      }

      this.logger.warn(
        'Resolved a down alert left open for a device that is up',
        {
          deviceId: alert.deviceId.toString(),
          alertId: alert.id.toString(),
          startedAt: alert.startedAt.toISOString()
        }
      );
      resolved++;
    }

    return Result.ok(resolved);
  }
}
