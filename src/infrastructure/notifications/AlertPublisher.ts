import { Result } from 'domain/shared/core';
import {
  IAlertPublisher,
  AlertNotification
} from 'application/shared/interfaces';
import { SendAlertNotificationUseCase } from 'application/notifications/use-cases';

export class AlertPublisher implements IAlertPublisher {
  constructor(
    private readonly sendAlertNotificationUseCase: SendAlertNotificationUseCase
  ) {}

  async publish(
    notification: AlertNotification
  ): Promise<Result<void>> {
    const result = await this.sendAlertNotificationUseCase.execute({
      deviceId: notification.deviceId,
      severity: notification.severity,
      source: notification.source,
      subject: notification.subject,
      detail: notification.detail,
      occurredAt: notification.occurredAt,
      resolved: notification.resolved
    });

    return result.isFailure ? Result.fail(result.error) : Result.ok();
  }
}
