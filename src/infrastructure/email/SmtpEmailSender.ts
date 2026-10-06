import nodemailer, { Transporter } from 'nodemailer';
import { Result } from 'domain/shared/core';
import {
  EmailMessage,
  IEmailSender
} from 'application/shared/interfaces';
import { SmtpConfig } from './smtpConfig';

export class SmtpEmailSender implements IEmailSender {
  private readonly transporter: Transporter;

  constructor(
    private readonly config: SmtpConfig,
    transporter?: Transporter
  ) {
    // Port 465 speaks TLS from the first byte; the others upgrade with
    // STARTTLS, which is then required rather than attempted.
    this.transporter =
      transporter ??
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        requireTLS: config.port !== 465,
        auth: { user: config.user, pass: config.password },
        disableFileAccess: true,
        disableUrlAccess: true
      });
  }

  async send(message: EmailMessage): Promise<Result<void>> {
    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: message.to,
        subject: message.subject,
        text: message.text
      });
      return Result.ok<void>();
    } catch (error) {
      return Result.fail<void>(
        `Email not sent: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
