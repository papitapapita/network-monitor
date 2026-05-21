import { IHandle } from 'domain/shared/interfaces';
import { DeviceWentOfflineEvent } from 'domain/device-monitoring/events';
import { SendDeviceDownAlertUseCase } from '../use-cases/SendDeviceDownAlertUseCase';

export class DeviceWentOfflineNotificationHandler
  implements IHandle<DeviceWentOfflineEvent>
{
  constructor(
    private readonly sendDeviceDownAlertUseCase: SendDeviceDownAlertUseCase
  ) {}

  async handle(event: DeviceWentOfflineEvent): Promise<void> {
    try {
      const result = await this.sendDeviceDownAlertUseCase.execute({
        deviceId: event.aggregateId.toString(),
        consecutiveFailures: event.consecutiveFailures,
        occurredAt: event.dateTimeOccurred
      });

      if (result.isFailure) {
        console.error(
          '[DeviceWentOfflineNotificationHandler] Use case failed',
          { error: result.error }
        );
      }
    } catch (error) {
      console.error(
        '[DeviceWentOfflineNotificationHandler] Unexpected error',
        {
          error:
            error instanceof Error ? error.message : String(error)
        }
      );
    }
  }
}
