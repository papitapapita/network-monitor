import { IHandle } from 'domain/shared/interfaces';
import { DeviceStatusChangedEvent } from 'domain/device-inventory/events';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';
import { ILogger } from 'application/shared/interfaces';

export class DeviceStatusChangedHandler
  implements IHandle<DeviceStatusChangedEvent>
{
  constructor(
    private readonly pollingConfigRepo: IPollingConfigurationRepository,
    private readonly logger: ILogger
  ) {}

  public async handle(event: DeviceStatusChangedEvent): Promise<void> {
    const { newStatus } = event;

    if (!newStatus.isInInventory() && !newStatus.isDamaged()) {
      return;
    }

    const deviceId = event.aggregateId;

    try {
      const result = await this.pollingConfigRepo.findByDeviceId(deviceId);
      if (result.isFailure || !result.value) {
        return;
      }

      const config = result.value;
      if (!config.enabled) {
        return;
      }

      config.disable();
      await this.pollingConfigRepo.save(config);
    } catch (error) {
      this.logger.error(
        '[DeviceStatusChangedHandler] Unexpected error',
        error instanceof Error ? error : undefined,
        {
          deviceId: deviceId.toString(),
          newStatus: newStatus.toString()
        }
      );
    }
  }
}
