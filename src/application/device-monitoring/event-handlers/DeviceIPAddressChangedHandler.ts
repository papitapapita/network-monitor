import { IHandle } from 'domain/shared/interfaces';
import { DeviceDetailsUpdatedEvent } from 'domain/device-inventory/events';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';
import { ILogger } from 'application/shared/interfaces';

export class DeviceIPAddressChangedHandler
  implements IHandle<DeviceDetailsUpdatedEvent>
{
  constructor(
    private readonly pollingConfigRepo: IPollingConfigurationRepository,
    private readonly logger: ILogger
  ) {}

  public async handle(
    event: DeviceDetailsUpdatedEvent
  ): Promise<void> {
    if (!('ipAddress' in event.updatedFields)) {
      return;
    }

    const deviceId = event.aggregateId;
    const newIpAddress = event.updatedFields.ipAddress ?? null;

    try {
      const result =
        await this.pollingConfigRepo.findByDeviceId(deviceId);
      if (result.isFailure || !result.value) {
        return;
      }

      const config = result.value;

      // losing the IP means the device can no longer be polled
      if (!newIpAddress) {
        config.disable();
      }

      const updateResult = config.updateIpAddress(newIpAddress);
      if (updateResult.isFailure) {
        return;
      }

      await this.pollingConfigRepo.save(config);
    } catch (error) {
      this.logger.error(
        '[DeviceIPAddressChangedHandler] Unexpected error',
        error instanceof Error ? error : undefined,
        {
          deviceId: deviceId.toString(),
          newIpAddress: newIpAddress?.toString() ?? null
        }
      );
    }
  }
}
