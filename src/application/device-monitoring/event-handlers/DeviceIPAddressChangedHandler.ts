import { IHandle } from 'domain/shared/interfaces';
import { DeviceDetailsUpdatedEvent } from 'domain/device-inventory/events';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';

export class DeviceIPAddressChangedHandler
  implements IHandle<DeviceDetailsUpdatedEvent>
{
  constructor(
    private readonly pollingConfigRepo: IPollingConfigurationRepository
  ) {}

  public async handle(event: DeviceDetailsUpdatedEvent): Promise<void> {
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
      config.updateIpAddress(newIpAddress);
      await this.pollingConfigRepo.save(config);
    } catch (error) {
      console.error(
        '[DeviceIPAddressChangedHandler] Unexpected error',
        {
          deviceId: deviceId.toString(),
          newIpAddress: newIpAddress?.toString() ?? null,
          error:
            error instanceof Error ? error.message : String(error)
        }
      );
    }
  }
}
