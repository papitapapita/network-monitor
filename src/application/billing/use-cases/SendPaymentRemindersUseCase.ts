import { Result } from 'domain/shared/core';
import { PhoneNumber } from 'domain/customers/value-objects';
import { Bill } from 'domain/billing/aggregates';
import {
  IBillRepository,
  IBillReminderLog
} from 'domain/billing/repository';
import {
  BillingSettings,
  ReminderDays
} from 'domain/billing/value-objects';
import { localDayOf } from 'domain/billing/value-objects/LocalDay';
import { UseCase } from 'application/shared/core';
import { IEmailSender, ILogger } from 'application/shared/interfaces';
import { ICustomerNotificationService } from 'application/notifications/interfaces';
import { IBillingContactsQuery } from '../interfaces';
import { reminderEmail, reminderTemplateParams } from '../services';

export interface SendPaymentRemindersRequestDTO {
  now: Date;
  settings: BillingSettings;
}

export interface SendPaymentRemindersResultDTO {
  // Bills a reminder went out for today, by at least one channel.
  reminded: number;
  failed: { id: string; error: string }[];
}

// BIL-321..323: on the last two grace days before the cut, every customer
// with an OVERDUE bill is reminded by email and, when the ISP has a reminder
// template, by WhatsApp. Once per bill per day, however often the run
// repeats.
export class SendPaymentRemindersUseCase extends UseCase<
  SendPaymentRemindersRequestDTO,
  SendPaymentRemindersResultDTO
> {
  constructor(
    private readonly billRepository: IBillRepository,
    private readonly reminderLog: IBillReminderLog,
    private readonly contacts: IBillingContactsQuery,
    private readonly emailSender: IEmailSender,
    // Null while WhatsApp is not set up on this install.
    private readonly whatsApp: ICustomerNotificationService | null,
    logger: ILogger
  ) {
    super(logger, 'SendPaymentRemindersUseCase');
  }

  protected async executeImpl(
    request: SendPaymentRemindersRequestDTO
  ): Promise<Result<SendPaymentRemindersResultDTO>> {
    const { now, settings } = request;
    const result: SendPaymentRemindersResultDTO = {
      reminded: 0,
      failed: []
    };
    if (!settings.automaticCutEnabled) return this.ok(result);

    const range = ReminderDays.dueRangeFor(now, settings.graceDays);
    if (range === null) return this.ok(result);

    const bills = await this.billRepository.findOverdueDueBetween(
      range.from,
      range.to
    );
    if (bills.isFailure) return this.fail(bills.error!);

    const today = localDayOf(now);
    for (const bill of bills.value) {
      const id = bill.id.toString();
      const already = await this.reminderLog.wasSentOn(
        bill.id,
        today
      );
      if (already.isFailure) {
        result.failed.push({ id, error: already.error! });
        continue;
      }
      if (already.value) continue;

      const sent = await this.remind(bill, settings, result.failed);
      if (!sent) continue;

      const recorded = await this.reminderLog.record(bill.id, today);
      if (recorded.isFailure) {
        result.failed.push({ id, error: recorded.error! });
      }
      result.reminded++;
    }
    return this.ok(result);
  }

  // True when at least one channel delivered.
  private async remind(
    bill: Bill,
    settings: BillingSettings,
    failed: SendPaymentRemindersResultDTO['failed']
  ): Promise<boolean> {
    const id = bill.id.toString();
    const contact = await this.contacts.findContact(
      bill.customerId.toString()
    );
    if (contact.isFailure) {
      failed.push({ id, error: contact.error! });
      return false;
    }
    if (contact.value === null) {
      failed.push({ id, error: 'Customer not found' });
      return false;
    }
    const content = {
      fullName: contact.value.fullName,
      period: bill.period.toString(),
      total: bill.total,
      cutDay: ReminderDays.cutDay(bill.dueDate, settings.graceDays)
    };

    let delivered = false;
    if (contact.value.email !== null) {
      const email = await this.emailSender.send({
        to: contact.value.email,
        ...reminderEmail(content)
      });
      if (email.isSuccess) delivered = true;
      else failed.push({ id, error: `Email: ${email.error}` });
    }

    const template = settings.reminderWhatsAppTemplate;
    if (template !== null && this.whatsApp !== null) {
      const phone = PhoneNumber.create(contact.value.phone);
      const sent = phone.isFailure
        ? Result.fail<void>(phone.error)
        : await this.whatsApp.sendTemplate(phone.value, {
            templateName: template,
            bodyParams: reminderTemplateParams(content)
          });
      if (sent.isSuccess) delivered = true;
      else failed.push({ id, error: `WhatsApp: ${sent.error}` });
    }
    return delivered;
  }
}
