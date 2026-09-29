import { Result } from 'domain/shared/core';
import {
  IAlertPublisher,
  AlertNotification
} from 'application/shared/interfaces';

// Delivers to every channel even when one fails: a Telegram outage in one
// chat must not also cost the other chat its copy.
export class FanOutAlertPublisher implements IAlertPublisher {
  constructor(private readonly publishers: IAlertPublisher[]) {}

  async publish(
    notification: AlertNotification
  ): Promise<Result<void>> {
    const results = await Promise.all(
      this.publishers.map((p) => p.publish(notification))
    );
    const errors = results
      .filter((r) => r.isFailure)
      .map((r) => r.error);
    return errors.length === 0
      ? Result.ok()
      : Result.fail(errors.join('; '));
  }
}
