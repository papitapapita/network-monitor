import { IHandle } from 'domain/shared/interfaces';
import { DeviceStatusChangedEvent } from 'domain/device-inventory/events';
import { IWirelessDeviceConfigRepository } from 'domain/wireless-monitoring/repository';
import { ILogger } from 'application/shared/interfaces';

// Retiring a device stops ICMP polling through DeviceStatusChangedHandler ->
// SuspendDeviceMonitoringUseCase, which only touches polling_configurations.
// The wireless orchestrator selects on wireless_polling_configurations.enabled,
// a separate flag nothing linked to status — so a radio marked DAMAGED kept
// being polled and kept writing snapshots. This is the wireless half of that
// suspension, mirroring DeviceDeletedWirelessConfigHandler.
//
// It re-enables in exactly one case, mirroring what ICMP monitoring does in
// the aggregate: arriving at COMMISSIONING turns polling back on (DEV-059).
// Every other return to service leaves the config off for an operator to
// enable deliberately — the same as ICMP, where restore() and a move to ACTIVE
// both leave monitoringEnabled false. Disabling rather than deleting is what
// makes resuming cheap: the interval and capacity survive the retirement.
export class DeviceStatusChangedWirelessConfigHandler
  implements IHandle<DeviceStatusChangedEvent>
{
  constructor(
    private readonly wirelessConfigRepo: IWirelessDeviceConfigRepository,
    private readonly logger: ILogger
  ) {}

  public async handle(
    event: DeviceStatusChangedEvent
  ): Promise<void> {
    const deviceId = event.aggregateId;
    const target = this.targetState(event);

    // Every other transition — including retired -> ACTIVE — leaves the flag
    // where it is, so an operator's own choice is never overwritten.
    if (target === null) {
      return;
    }

    try {
      const configResult =
        await this.wirelessConfigRepo.findByDeviceId(deviceId);
      if (configResult.isFailure) {
        this.logger.error(
          '[DeviceStatusChangedWirelessConfigHandler] Failed to load wireless config',
          undefined,
          {
            deviceId: deviceId.toString(),
            error: configResult.error
          }
        );
        return;
      }

      const config = configResult.value;
      if (config === null || config.enabled === target) {
        return;
      }

      const toggleResult = target
        ? config.enable()
        : config.disable();

      if (toggleResult.isFailure) {
        this.logger.error(
          '[DeviceStatusChangedWirelessConfigHandler] Failed to toggle wireless config',
          undefined,
          {
            deviceId: deviceId.toString(),
            enabled: target,
            error: toggleResult.error
          }
        );
        return;
      }

      await this.wirelessConfigRepo.save(config);
    } catch (error) {
      this.logger.error(
        '[DeviceStatusChangedWirelessConfigHandler] Unexpected error',
        error instanceof Error ? error : new Error(String(error)),
        {
          deviceId: deviceId.toString(),
          newStatus: event.newStatus.toString()
        }
      );
    }
  }

  // false = turn polling off, true = turn it on, null = leave it alone.
  private targetState(
    event: DeviceStatusChangedEvent
  ): boolean | null {
    if (event.newStatus.isRetired()) {
      return false;
    }
    if (event.newStatus.isCommissioning()) {
      return true;
    }
    return null;
  }
}
