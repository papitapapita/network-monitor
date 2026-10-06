import { User } from 'domain/identity';
import { IEmailSender, ILogger } from 'application/shared/interfaces';
import { newSignInEmail } from './accountEmails';
import { sendWithoutWaiting } from './sendWithoutWaiting';

// IDN-181.
export class NewSignInWarning {
  constructor(
    private readonly emailSender: IEmailSender,
    private readonly logger: ILogger
  ) {}

  public send(
    user: User,
    sourceIp: string | null,
    at: Date = new Date()
  ): Promise<void> {
    return sendWithoutWaiting(
      this.emailSender,
      newSignInEmail(user.email.toString(), at, sourceIp),
      this.logger,
      { source: 'NewSignInWarning', userId: user.id.toString() }
    );
  }
}
