import { IHandle } from 'domain/shared/interfaces';
import { DeviceWentOfflineEvent } from 'domain/device-monitoring/events';
import { ILogger } from 'application/shared/interfaces';
import { SendDeviceDownAlertUseCase } from '../use-cases';

export class DeviceWentOfflineNotificationHandler
  implements IHandle<DeviceWentOfflineEvent>
{
  constructor(
    private readonly sendDeviceDownAlertUseCase: SendDeviceDownAlertUseCase,
    private readonly logger: ILogger
  ) {}

  async handle(event: DeviceWentOfflineEvent): Promise<void> {
    try {
      const result = await this.sendDeviceDownAlertUseCase.execute({
        deviceId: event.aggregateId.toString(),
        consecutiveFailures: event.consecutiveFailures,
        occurredAt: event.dateTimeOccurred
      });

      if (result.isFailure) {
        this.logger.error(
          'DeviceWentOfflineNotificationHandler: use case failed',
          undefined,
          { error: result.error }
        );
      }
    } catch (error) {
      this.logger.error(
        'DeviceWentOfflineNotificationHandler: unexpected error',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
