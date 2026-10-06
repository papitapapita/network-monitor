import { Result } from 'domain/shared/core';
import {
  EmailMessage,
  IEmailSender,
  ILogger
} from 'application/shared/interfaces';

export const EMAIL_NOT_CONFIGURED = 'Email is not configured';

// Stands in while SMTP_HOST is unset (IDN-180). The body is never logged: it
// can carry a sign-in link.
export class UnconfiguredEmailSender implements IEmailSender {
  constructor(private readonly logger: ILogger) {}

  async send(message: EmailMessage): Promise<Result<void>> {
    this.logger.warn('Email not sent: SMTP_HOST is not set', {
      to: message.to,
      subject: message.subject
    });
    return Result.fail<void>(EMAIL_NOT_CONFIGURED);
  }
}
