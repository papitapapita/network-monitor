import { User } from 'domain/identity';
import { IEmailSender, ILogger } from 'application/shared/interfaces';
import { newSignInEmail } from './accountEmails';

// IDN-181. The sign-in does not wait for it: a slow or failing mail server
// must neither hold it up nor refuse it.
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
    return this.emailSender
      .send(newSignInEmail(user.email.toString(), at, sourceIp))
      .then((sent) => {
        if (sent.isFailure) {
          this.logger.warn('NewSignInWarning: email not sent', {
            userId: user.id.toString(),
            error: sent.error
          });
        }
      })
      .catch((error: unknown) => {
        this.logger.error(
          'NewSignInWarning: unexpected error',
          error instanceof Error ? error : new Error(String(error))
        );
      });
  }
}
