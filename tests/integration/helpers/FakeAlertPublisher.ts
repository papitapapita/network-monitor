import { Result } from 'domain/shared/core';
import {
  AlertNotification,
  IAlertPublisher
} from 'application/shared/interfaces';

// Stands in for the publisher chain (Telegram, push, inbox): records every
// notice and answers what the test set.
export class FakeAlertPublisher implements IAlertPublisher {
  readonly sent: AlertNotification[] = [];
  private answer: Result<void> = Result.ok();

  answerWith(answer: Result<void>): void {
    this.answer = answer;
  }

  reset(): void {
    this.sent.length = 0;
    this.answer = Result.ok();
  }

  async publish(
    notification: AlertNotification
  ): Promise<Result<void>> {
    this.sent.push(notification);
    return this.answer;
  }
}
