import { Result } from 'domain/shared/core';
import {
  IAlertPublisher,
  AlertNotification,
  ILogger
} from 'application/shared/interfaces';
import { RecordInboxNotificationUseCase } from 'application/notifications/use-cases';

// Outermost on every path to staff (NOT-267): the inbox keeps what quiet
// hours, mutes, an expired subscription or the wireless switch keep off
// Telegram and phones. A failed recording is logged and never blocks delivery.
export class InboxAlertPublisher implements IAlertPublisher {
  constructor(
    private readonly inner: IAlertPublisher,
    private readonly recordUseCase: RecordInboxNotificationUseCase,
    private readonly logger: ILogger
  ) {}

  async publish(
    notification: AlertNotification
  ): Promise<Result<void>> {
    const recorded = await this.recordUseCase.execute({
      type: notification.type,
      severity: notification.severity,
      resolved: notification.resolved,
      title: notification.summary,
      body: notification.detail,
      deviceId: notification.deviceId,
      alertId: notification.alertId ?? null,
      occurredAt: notification.occurredAt
    });
    if (recorded.isFailure) {
      this.logger.warn('Inbox notification not recorded', {
        type: notification.type,
        error: recorded.error
      });
    }
    return this.inner.publish(notification);
  }
}
