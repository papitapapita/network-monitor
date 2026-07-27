import { Result } from 'domain/shared/core';
import { PhoneNumber } from 'domain/customers/value-objects';

export interface CustomerTemplateMessage {
  bodyParams: string[];
}

export interface ICustomerNotificationService {
  sendTemplate(
    to: PhoneNumber,
    message: CustomerTemplateMessage
  ): Promise<Result<void>>;
}
