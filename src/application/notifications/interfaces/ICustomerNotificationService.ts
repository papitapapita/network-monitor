import { Result } from 'domain/shared/core';
import { PhoneNumber } from 'domain/customers/value-objects';

export interface CustomerTemplateMessage {
  bodyParams: string[];
  // Another approved template than the settings' own (the suspension
  // notice), such as the payment reminder (BIL-322).
  templateName?: string;
  // A PDF for a template whose header is a document, such as the issued
  // bill (BIL-324).
  document?: { filename: string; content: Buffer };
}

export interface ICustomerNotificationService {
  sendTemplate(
    to: PhoneNumber,
    message: CustomerTemplateMessage
  ): Promise<Result<void>>;
}
