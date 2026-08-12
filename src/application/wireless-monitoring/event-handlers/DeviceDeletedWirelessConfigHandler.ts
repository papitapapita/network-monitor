import { IHandle } from 'domain/shared/interfaces';
import { DeviceDeletedEvent } from 'domain/device-inventory/events';
import { IWirelessDeviceConfigRepository } from 'domain/wireless-monitoring/repository';
import { ILogger } from 'application/shared/interfaces';

// Deleting a device stops ICMP polling on its own — softDelete turns monitoring
// off, and DeviceMonitoringToggledHandler reacts to that. Wireless polling does
// not follow, because the wireless orchestrator selects on
// wireless_polling_configurations.enabled and nothing links the two flags.
//
// Without this handler a soft-deleted device keeps collecting snapshots and
// raising wireless alerts for a device that no longer appears anywhere in the
// UI. Disabling rather than deleting the config means a restore inside the
// grace period can turn it back on with its interval and capacity intact.
export class DeviceDeletedWirelessConfigHandler
  implements IHandle<DeviceDeletedEvent>
{
  constructor(
    private readonly wirelessConfigRepo: IWirelessDeviceConfigRepository,
    private readonly logger: ILogger
  ) {}

  public async handle(event: DeviceDeletedEvent): Promise<void> {
    const deviceId = event.aggregateId;

    try {
      const configResult =
        await this.wirelessConfigRepo.findByDeviceId(deviceId);
      if (configResult.isFailure) {
        this.logger.error(
          '[DeviceDeletedWirelessConfigHandler] Failed to load wireless config',
          undefined,
          {
            deviceId: deviceId.toString(),
            error: configResult.error
          }
        );
        return;
      }

      const config = configResult.value;
      if (config === null || !config.enabled) {
        return;
      }

      const disableResult = config.disable();
      if (disableResult.isFailure) {
        this.logger.error(
          '[DeviceDeletedWirelessConfigHandler] Failed to disable wireless config',
          undefined,
          {
            deviceId: deviceId.toString(),
            error: disableResult.error
          }
        );
        return;
      }

      await this.wirelessConfigRepo.save(config);
    } catch (error) {
      this.logger.error(
        '[DeviceDeletedWirelessConfigHandler] Unexpected error',
        error instanceof Error ? error : undefined,
        { deviceId: deviceId.toString() }
      );
    }
  }
}
