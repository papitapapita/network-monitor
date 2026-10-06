import { Result } from 'domain/shared/core';
import { PhoneNumber } from 'domain/customers/value-objects';

export interface CustomerTemplateMessage {
  bodyParams: string[];
  // Another approved template than the settings' own (the suspension
  // notice), such as the payment reminder (BIL-322).
  templateName?: string;
}

export interface ICustomerNotificationService {
  sendTemplate(
    to: PhoneNumber,
    message: CustomerTemplateMessage
  ): Promise<Result<void>>;
}
