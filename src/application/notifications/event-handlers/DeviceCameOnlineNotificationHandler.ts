import { IHandle } from 'domain/shared/interfaces';
import { DeviceCameOnlineEvent } from 'domain/device-monitoring/events';
import { ILogger } from 'application/shared/interfaces';
import { SendDeviceRecoveryAlertUseCase } from '../use-cases';

export class DeviceCameOnlineNotificationHandler
  implements IHandle<DeviceCameOnlineEvent>
{
  constructor(
    private readonly sendDeviceRecoveryAlertUseCase: SendDeviceRecoveryAlertUseCase,
    private readonly logger: ILogger
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
        this.logger.error(
          'DeviceCameOnlineNotificationHandler: use case failed',
          undefined,
          { error: result.error }
        );
      }
    } catch (error) {
      this.logger.error(
        'DeviceCameOnlineNotificationHandler: unexpected error',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
