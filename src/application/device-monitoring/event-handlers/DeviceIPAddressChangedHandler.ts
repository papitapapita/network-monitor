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
    // The event always carries the ipAddress key; undefined means the update
    // left the IP alone, null means it was cleared. Testing for the key read
    // every name or description edit as a cleared IP and turned polling off.
    const newIpAddress = event.updatedFields.ipAddress;
    if (newIpAddress === undefined) {
      return;
    }

    const deviceId = event.aggregateId;

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
