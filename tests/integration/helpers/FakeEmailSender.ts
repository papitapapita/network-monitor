import { Result } from '../../../src/domain/shared/core/Result';
import {
  EmailMessage,
  IEmailSender
} from '../../../src/application/shared/interfaces/IEmailSender';

/** Records emails instead of handing them to an SMTP server. */
export class FakeEmailSender implements IEmailSender {
  public sent: EmailMessage[] = [];
  public failWith: string | null = null;

  async send(message: EmailMessage): Promise<Result<void>> {
    if (this.failWith) return Result.fail(this.failWith);
    this.sent.push(message);
    return Result.ok();
  }
}
