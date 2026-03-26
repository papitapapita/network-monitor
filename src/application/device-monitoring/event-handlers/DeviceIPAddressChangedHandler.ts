import { IHandle } from 'domain/shared/interfaces';
import { DeviceDetailsUpdatedEvent } from 'domain/device-inventory/events';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';

/**
 * DeviceIPAddressChangedHandler
 *
 * Listens to DeviceDetailsUpdatedEvent from the device-inventory context.
 * When the IP address field is part of the update, syncs the new value
 * into the device's PollingConfiguration so polling targets the correct host.
 *
 * No-op when:
 * - ipAddress was not part of the update (undefined in updatedFields)
 * - no PollingConfiguration exists for the device (monitoring not enabled)
 */
export class DeviceIPAddressChangedHandler
  implements IHandle<DeviceDetailsUpdatedEvent>
{
  constructor(
    private readonly pollingConfigRepo: IPollingConfigurationRepository
  ) {}

  async handle(event: DeviceDetailsUpdatedEvent): Promise<void> {
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
