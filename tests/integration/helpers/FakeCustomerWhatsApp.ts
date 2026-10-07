import { Result } from '../../../src/domain/shared/core/Result';
import { PhoneNumber } from '../../../src/domain/customers/value-objects';
import {
  CustomerTemplateMessage,
  ICustomerNotificationService
} from '../../../src/application/notifications/interfaces';

/** Records WhatsApp template sends instead of calling Meta. */
export class FakeCustomerWhatsApp
  implements ICustomerNotificationService
{
  public sent: ({ to: string } & CustomerTemplateMessage)[] = [];
  public failWith: string | null = null;

  async sendTemplate(
    to: PhoneNumber,
    message: CustomerTemplateMessage
  ): Promise<Result<void>> {
    if (this.failWith) return Result.fail(this.failWith);
    this.sent.push({ to: to.value, ...message });
    return Result.ok();
  }
}
