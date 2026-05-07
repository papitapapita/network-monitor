import { Result } from '../../../src/domain/shared/core/Result';
import {
  INotificationService,
  NotificationMessage
} from '../../../src/application/notifications/interfaces/INotificationService';

/**
 * Controllable stub for INotificationService used in integration tests.
 * Call setShouldFail(true) to simulate a Telegram delivery failure.
 * Inspect lastMessage to assert what was sent.
 */
export class FakeNotificationService implements INotificationService {
  private _shouldFail = false;
  public lastMessage: NotificationMessage | null = null;
  public callCount = 0;

  setShouldFail(fail: boolean): void {
    this._shouldFail = fail;
  }

  reset(): void {
    this._shouldFail = false;
    this.lastMessage = null;
    this.callCount = 0;
  }

  async send(message: NotificationMessage): Promise<Result<void>> {
    this.lastMessage = message;
    this.callCount++;
    if (this._shouldFail) {
      return Result.fail('Telegram API error: 429 Too Many Requests');
    }
    return Result.ok(undefined);
  }
}
