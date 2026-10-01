import { Result } from 'domain/shared/core';
import {
  IAlertPublisher,
  AlertNotification
} from 'application/shared/interfaces';

// Skips an optional channel, as a success, while it is not configured — the
// vendor's chat before the vendor sets one (AGT-023) — instead of reporting a
// delivery failure on every alert. Asked on every publish, so setting the
// channel from the dashboard applies with no restart.
export class WhenConfiguredAlertPublisher implements IAlertPublisher {
  constructor(
    private readonly inner: IAlertPublisher,
    private readonly isConfigured: () => Promise<boolean>
  ) {}

  async publish(
    notification: AlertNotification
  ): Promise<Result<void>> {
    if (!(await this.isConfigured())) return Result.ok();
    return this.inner.publish(notification);
  }
}
