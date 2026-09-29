import { Result } from 'domain/shared/core';
import {
  IAlertPublisher,
  AlertNotification,
  SUBSCRIPTION_EXPIRED_SUPPRESSED,
  ILogger
} from 'application/shared/interfaces';
import { GetSubscriptionStatusUseCase } from 'application/shared/use-cases/GetSubscriptionStatusUseCase';

// Outermost decorator on every outbound alert, device or not (ADR 0002, R17):
// an install past its grace period sends nothing. Alert records are still
// kept, and an unnotified down alert is sent on the first scan after payment
// resumes if the device is still down.
export class SubscriptionAlertPublisher implements IAlertPublisher {
  constructor(
    private readonly inner: IAlertPublisher,
    private readonly getSubscriptionStatus: GetSubscriptionStatusUseCase,
    private readonly logger: ILogger
  ) {}

  async publish(
    notification: AlertNotification
  ): Promise<Result<void>> {
    const status = await this.getSubscriptionStatus.execute();
    if (status.isFailure) {
      // Never silence alerts on a failure to read our own configuration.
      this.logger.warn(
        'Subscription status unavailable; alert sent',
        {
          error: status.error
        }
      );
      return this.inner.publish(notification);
    }
    if (status.value.readOnly) {
      return Result.fail(SUBSCRIPTION_EXPIRED_SUPPRESSED);
    }
    return this.inner.publish(notification);
  }
}
