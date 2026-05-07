import { IHandle } from 'domain/shared/interfaces';
import { DeviceCameOnlineEvent } from 'domain/device-monitoring/events';
import { SendDeviceRecoveryAlertUseCase } from '../use-cases';

export class DeviceCameOnlineNotificationHandler
  implements IHandle<DeviceCameOnlineEvent>
{
  constructor(
    private readonly sendDeviceRecoveryAlertUseCase: SendDeviceRecoveryAlertUseCase
  ) {}

  async handle(event: DeviceCameOnlineEvent): Promise<void> {
    try {
      const result =
        await this.sendDeviceRecoveryAlertUseCase.execute({
          deviceId: event.aggregateId.toString(),
          latencyMs: event.latencyMs,
          occurredAt: event.dateTimeOccurred
        });

      if (result.isFailure) {
        console.error(
          '[DeviceCameOnlineNotificationHandler] Use case failed',
          { error: result.error }
        );
      }
    } catch (error) {
      console.error(
        '[DeviceCameOnlineNotificationHandler] Unexpected error',
        {
          error:
            error instanceof Error ? error.message : String(error)
        }
      );
    }
  }
}
