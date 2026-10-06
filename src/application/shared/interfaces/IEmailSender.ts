import { Result } from 'domain/shared/core';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface IEmailSender {
  send(message: EmailMessage): Promise<Result<void>>;
}
