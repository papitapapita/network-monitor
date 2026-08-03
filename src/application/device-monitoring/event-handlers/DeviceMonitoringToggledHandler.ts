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
import { ILogger } from 'application/shared/interfaces';
import { SuspendDeviceMonitoringUseCase } from '../use-cases/SuspendDeviceMonitoringUseCase';

export class DeviceMonitoringToggledHandler
  implements IHandle<DeviceMonitoringToggledEvent>
{
  constructor(
    private readonly pollingConfigRepo: IPollingConfigurationRepository,
    private readonly suspendDeviceMonitoring: SuspendDeviceMonitoringUseCase,
    private readonly logger: ILogger
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
          if (event.ipAddress) {
            const ipUpdateResult = existingConfig.updateIpAddress(
              event.ipAddress
            );
            if (ipUpdateResult.isFailure) {
              this.logger.error(
                '[DeviceMonitoringToggledHandler] Failed to update IP address',
                undefined,
                {
                  deviceId: deviceId.toString(),
                  error: ipUpdateResult.error
                }
              );
              return;
            }
          }

          const enableResult = existingConfig.enable();
          if (enableResult.isFailure) {
            this.logger.error(
              '[DeviceMonitoringToggledHandler] Cannot enable polling',
              undefined,
              {
                deviceId: deviceId.toString(),
                error: enableResult.error
              }
            );
            return;
          }

          await this.pollingConfigRepo.save(existingConfig);
        }
      } else {
        const suspendResult =
          await this.suspendDeviceMonitoring.execute(deviceId);
        if (suspendResult.isFailure) {
          this.logger.error(
            '[DeviceMonitoringToggledHandler] Failed to suspend monitoring',
            undefined,
            {
              deviceId: deviceId.toString(),
              error: suspendResult.error
            }
          );
        }
      }
    } catch (error) {
      this.logger.error(
        '[DeviceMonitoringToggledHandler] Unexpected error',
        error instanceof Error ? error : undefined,
        {
          deviceId: deviceId.toString(),
          monitoringEnabled: event.monitoringEnabled
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
      this.logger.error(
        '[DeviceMonitoringToggledHandler] Failed to create PollingConfiguration',
        undefined,
        { deviceId: deviceId.toString(), error: configResult.error }
      );
      return;
    }

    await this.pollingConfigRepo.save(configResult.value);
  }
}
