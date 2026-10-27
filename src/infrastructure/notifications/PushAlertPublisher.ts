import { Result } from 'domain/shared/core';
import {
  IAlertPublisher,
  AlertNotification,
  ILogger
} from 'application/shared/interfaces';
import { SendPushAlertUseCase } from 'application/notifications/use-cases';

// Always reports success (NOT-222): a failure here would leave the alert
// unnotified and retried, sending the Telegram copy a second time.
export class PushAlertPublisher implements IAlertPublisher {
  constructor(
    private readonly sendPushAlertUseCase: SendPushAlertUseCase,
    private readonly logger: ILogger
  ) {}

  async publish(
    notification: AlertNotification
  ): Promise<Result<void>> {
    const result = await this.sendPushAlertUseCase.execute({
      deviceId: notification.deviceId,
      severity: notification.severity,
      summary: notification.summary,
      detail: notification.shortDetail ?? notification.detail,
      resolved: notification.resolved,
      type: notification.type
    });
    if (result.isFailure) {
      this.logger.warn('Push alert not sent', {
        error: result.error
      });
    }
    return Result.ok();
  }
}
