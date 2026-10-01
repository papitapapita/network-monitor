import { Result } from '../../../src/domain/shared/core/Result';
import { ITestMessageSender } from '../../../src/application/notifications/interfaces/ITestMessageSender';

/** Records test messages instead of sending them to Telegram. */
export class FakeTestMessageSender implements ITestMessageSender {
  public sent: { chatId: string; text: string }[] = [];
  public failWith: string | null = null;

  async send(chatId: string, text: string): Promise<Result<void>> {
    if (this.failWith) return Result.fail(this.failWith);
    this.sent.push({ chatId, text });
    return Result.ok();
  }
}
