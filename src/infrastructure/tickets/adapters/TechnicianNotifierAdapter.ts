import { Result } from 'domain/shared/core';
import { PhoneNumber } from 'domain/customers/value-objects';
import { ICustomerNotificationService } from 'application/notifications/interfaces';
import {
  ITechnicianNotifier,
  TechnicianAssignmentNotice
} from 'application/tickets';

/**
 * Bridges the tickets context onto the WhatsApp sender. Constructing the
 * customers-context PhoneNumber here is what keeps that value object out of
 * the tickets domain.
 */
export class TechnicianNotifierAdapter
  implements ITechnicianNotifier
{
  constructor(
    private readonly notificationService: ICustomerNotificationService
  ) {}

  async notifyAssignment(
    notice: TechnicianAssignmentNotice
  ): Promise<Result<void>> {
    const phoneResult = PhoneNumber.create(notice.phone);
    if (phoneResult.isFailure) {
      return Result.fail(
        `Invalid technician phone: ${phoneResult.error}`
      );
    }

    return this.notificationService.sendTemplate(phoneResult.value, {
      bodyParams: [
        notice.technicianName,
        notice.ticketCode,
        notice.ticketTitle,
        notice.scheduledFor ?? 'sin fecha'
      ]
    });
  }
}
