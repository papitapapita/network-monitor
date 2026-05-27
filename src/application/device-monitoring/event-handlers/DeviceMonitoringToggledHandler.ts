import { IHandle } from 'domain/shared/interfaces';
import { DeviceMonitoringToggledEvent } from 'domain/device-inventory/events';
import { DeviceId, PollingConfigurationId } from 'domain/shared/ids';
import {
  PollingInterval,
  FailureThreshold
} from 'domain/device-monitoring/value-objects';
import { PollingConfiguration } from 'domain/device-monitoring/entities';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';
import { IPAddress } from 'domain/shared';

export class DeviceMonitoringToggledHandler
  implements IHandle<DeviceMonitoringToggledEvent>
{
  constructor(
    private readonly pollingConfigRepo: IPollingConfigurationRepository
  ) {}

  public async handle(event: DeviceMonitoringToggledEvent): Promise<void> {
    const deviceId = event.aggregateId;

    try {
      const existingResult =
        await this.pollingConfigRepo.findByDeviceId(deviceId);
      const existingConfig = existingResult.isSuccess
        ? existingResult.value
        : null;

      if (event.monitoringEnabled) {
        if (!existingConfig) {
          await this.createConfig(deviceId, event.ipAddress);
        } else {
          existingConfig.enable();
          if (event.ipAddress) {
            existingConfig.updateIpAddress(event.ipAddress);
          }
          await this.pollingConfigRepo.save(existingConfig);
        }
      } else {
        if (existingConfig) {
          existingConfig.disable();
          await this.pollingConfigRepo.save(existingConfig);
        }
      }
    } catch (error) {
      console.error(
        '[DeviceMonitoringToggledHandler] Unexpected error',
        {
          deviceId: deviceId.toString(),
          monitoringEnabled: event.monitoringEnabled,
          error:
            error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  private async createConfig(
    deviceId: DeviceId,
    ipAddress: IPAddress
  ): Promise<void> {
    const configId = PollingConfigurationId.create();
    const interval = PollingInterval.createDefault();
    const threshold = FailureThreshold.createDefault();

    const configResult = PollingConfiguration.create(
      {
        deviceId,
        ipAddress,
        interval,
        failuresBeforeDown: threshold,
        enabled: true
      },
      configId
    );

    if (configResult.isFailure) {
      console.error(
        '[DeviceMonitoringToggledHandler] Failed to create PollingConfiguration',
        {
          deviceId: deviceId.toString(),
          error: configResult.error
        }
      );
      return;
    }

    await this.pollingConfigRepo.save(configResult.value);
  }
}
