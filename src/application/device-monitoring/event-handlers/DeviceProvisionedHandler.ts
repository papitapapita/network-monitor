import { IHandle } from 'domain/shared/interfaces';
import { DeviceCreatedEvent } from 'domain/device-inventory/events';
import { PollingConfigurationId } from 'domain/shared/ids';
import {
  PollingInterval,
  FailureThreshold
} from 'domain/device-monitoring/value-objects';
import { PollingConfiguration } from 'domain/device-monitoring/entities';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';

/**
 * DeviceProvisionedHandler
 *
 * Listens to DeviceCreatedEvent from the device-inventory context.
 * When a new device is created with monitoring enabled and an IP address,
 * creates a default PollingConfiguration entity in the monitoring context.
 */
export class DeviceProvisionedHandler
  implements IHandle<DeviceCreatedEvent>
{
  constructor(
    private readonly pollingConfigRepo: IPollingConfigurationRepository
  ) {}

  async handle(event: DeviceCreatedEvent): Promise<void> {
    if (!event.monitoringEnabled || !event.ipAddress) {
      return;
    }

    const deviceId = event.aggregateId;

    try {
      const configId = PollingConfigurationId.create();
      const interval = PollingInterval.createDefault();
      const threshold = FailureThreshold.createDefault();

      const configResult = PollingConfiguration.create(
        {
          deviceId,
          ipAddress: event.ipAddress,
          interval: interval,
          failuresBeforeDown: threshold,
          enabled: true
        },
        configId
      );

      if (configResult.isFailure) {
        console.error(
          '[DeviceProvisionedHandler] Failed to create PollingConfiguration',
          {
            deviceId: deviceId.toString(),
            error: configResult.error
          }
        );
        return;
      }

      await this.pollingConfigRepo.save(configResult.value);
    } catch (error) {
      console.error('[DeviceProvisionedHandler] Unexpected error', {
        deviceId: deviceId.toString(),
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
