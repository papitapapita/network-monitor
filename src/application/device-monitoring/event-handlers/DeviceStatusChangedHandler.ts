import { IHandle } from 'domain/shared/interfaces';
import { DeviceStatusChangedEvent } from 'domain/device-inventory/events';
import { ILogger } from 'application/shared/interfaces';
import { SuspendDeviceMonitoringUseCase } from '../use-cases/SuspendDeviceMonitoringUseCase';

export class DeviceStatusChangedHandler
  implements IHandle<DeviceStatusChangedEvent>
{
  constructor(
    private readonly suspendDeviceMonitoring: SuspendDeviceMonitoringUseCase,
    private readonly logger: ILogger
  ) {}

  public async handle(
    event: DeviceStatusChangedEvent
  ): Promise<void> {
    const { newStatus } = event;

    // Every retired status — INVENTORY, DAMAGED, DECOMMISSIONED — means the
    // unit is off the network, so nothing should still be pinging it.
    if (!newStatus.isRetired()) {
      return;
    }

    const deviceId = event.aggregateId;

    try {
      const result =
        await this.suspendDeviceMonitoring.execute(deviceId);
      if (result.isFailure) {
        this.logger.error(
          '[DeviceStatusChangedHandler] Failed to suspend monitoring',
          undefined,
          { deviceId: deviceId.toString(), error: result.error }
        );
      }
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
