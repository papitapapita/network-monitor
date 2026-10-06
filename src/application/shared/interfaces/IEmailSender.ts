import { Result } from 'domain/shared/core';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  attachments?: EmailAttachment[];
}

export interface IEmailSender {
  send(message: EmailMessage): Promise<Result<void>>;
}
