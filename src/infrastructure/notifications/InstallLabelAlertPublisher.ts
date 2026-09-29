import { Result } from 'domain/shared/core';
import {
  IAlertPublisher,
  AlertNotification
} from 'application/shared/interfaces';

// The vendor chat hears from every customer's install, so each message says
// which install it came from.
export class InstallLabelAlertPublisher implements IAlertPublisher {
  constructor(
    private readonly inner: IAlertPublisher,
    private readonly installLabel: string
  ) {}

  async publish(
    notification: AlertNotification
  ): Promise<Result<void>> {
    return this.inner.publish({
      ...notification,
      source: `${notification.source} · ${this.installLabel}`
    });
  }
}
