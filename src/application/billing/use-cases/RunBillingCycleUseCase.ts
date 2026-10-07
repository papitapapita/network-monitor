import { Result } from 'domain/shared/core';
import { CustomerId } from 'domain/shared/ids';
import {
  BillingCycle,
  BillingSettings,
  isoDay
} from 'domain/billing/value-objects';
import {
  IBillRepository,
  IBillingSettingsRepository
} from 'domain/billing/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IBillableCustomersQuery,
  ICustomerServiceAccess
} from '../interfaces';
import {
  RunBillingCycleRequestDTO,
  BillingCycleRunResultDTO
} from '../dtos';
import { GenerateBillUseCase } from './GenerateBillUseCase';
import { SendBillEmailUseCase } from './SendBillEmailUseCase';
import { SendBillWhatsAppUseCase } from './SendBillWhatsAppUseCase';
import { SendPaymentRemindersUseCase } from './SendPaymentRemindersUseCase';

type Failures = BillingCycleRunResultDTO['failed'];

const DAY_MS = 24 * 60 * 60 * 1000;

// The daily billing run (BIL-284): marks unpaid bills overdue once their due
// date has passed, cuts customers still unpaid after the grace days when the
// automatic cut is on (BIL-310), sends the payment reminders of the last two
// grace days (BIL-321), then issues the bills whose issue window is open and
// sends them by email and, with a bill template, WhatsApp (BIL-324). Does
// nothing while automatic billing is off. Safe to repeat: a period already
// billed — even cancelled — is never billed again by the run. Bills it issues
// are prorated (BIL-287..290); a customer whose services all start after the
// billed month waits for the next cycle.
export class RunBillingCycleUseCase extends UseCase<
  RunBillingCycleRequestDTO,
  BillingCycleRunResultDTO
> {
  constructor(
    private readonly settingsRepository: IBillingSettingsRepository,
    private readonly billableCustomers: IBillableCustomersQuery,
    private readonly billRepository: IBillRepository,
    private readonly generateBillUseCase: GenerateBillUseCase,
    private readonly serviceAccess: ICustomerServiceAccess,
    private readonly sendBillEmail: SendBillEmailUseCase,
    private readonly sendBillWhatsApp: SendBillWhatsAppUseCase,
    private readonly sendReminders: SendPaymentRemindersUseCase,
    logger: ILogger
  ) {
    super(logger, 'RunBillingCycleUseCase');
  }

  protected async executeImpl(
    request: RunBillingCycleRequestDTO
  ): Promise<Result<BillingCycleRunResultDTO>> {
    const settingsResult = await this.settingsRepository.get();
    if (settingsResult.isFailure) {
      return this.fail(
        `Failed to load billing settings: ${settingsResult.error}`
      );
    }
    const settings = settingsResult.value;
    if (!settings.automaticBillingEnabled) {
      return this.ok({
        automaticBillingEnabled: false,
        generated: 0,
        markedOverdue: 0,
        cut: 0,
        reminded: 0,
        emailed: 0,
        whatsAppSent: 0,
        failed: []
      });
    }

    const failed: Failures = [];

    const overdue = await this.markOverdue(request.now, failed);
    if (overdue.isFailure) return this.fail(overdue.error!);

    const cut = settings.automaticCutEnabled
      ? await this.cutUnpaid(request.now, settings.graceDays, failed)
      : Result.ok(0);
    if (cut.isFailure) return this.fail(cut.error!);

    const reminders = await this.sendReminders.execute({
      now: request.now,
      settings
    });
    if (reminders.isFailure) return this.fail(reminders.error!);
    failed.push(...reminders.value.failed);

    const generated = await this.issueBills(
      request.now,
      settings,
      failed
    );
    if (generated.isFailure) return this.fail(generated.error!);

    return this.ok({
      automaticBillingEnabled: true,
      generated: generated.value.generated,
      markedOverdue: overdue.value,
      cut: cut.value,
      reminded: reminders.value.reminded,
      emailed: generated.value.emailed,
      whatsAppSent: generated.value.whatsAppSent,
      failed
    });
  }

  private async markOverdue(
    now: Date,
    failed: Failures
  ): Promise<Result<number>> {
    const pastDue =
      await this.billRepository.findPendingDueBefore(now);
    if (pastDue.isFailure) return Result.fail(pastDue.error!);

    let marked = 0;
    for (const bill of pastDue.value) {
      const id = bill.id.toString();
      const transition = bill.markOverdue(now);
      if (transition.isFailure) {
        failed.push({ id, error: transition.error! });
        continue;
      }
      const saved = await this.billRepository.save(bill);
      if (saved.isFailure) {
        failed.push({ id, error: saved.error! });
        continue;
      }
      marked++;
    }
    return Result.ok(marked);
  }

  // BIL-310: the day after the last grace day, every customer still holding
  // an OVERDUE bill has their active services suspended.
  private async cutUnpaid(
    now: Date,
    graceDays: number,
    failed: Failures
  ): Promise<Result<number>> {
    const graceEnd = new Date(now.getTime() - graceDays * DAY_MS);
    const customers =
      await this.billRepository.findCustomersOverdueBefore(graceEnd);
    if (customers.isFailure) return Result.fail(customers.error!);

    let cut = 0;
    for (const customerId of customers.value) {
      const id = customerId.toString();
      const outcome =
        await this.serviceAccess.suspendActiveServices(id);
      if (outcome.isFailure) {
        failed.push({ id, error: outcome.error! });
        continue;
      }
      failed.push(...outcome.value.failed);
      if (outcome.value.changed > 0) cut++;
    }
    return Result.ok(cut);
  }

  private async issueBills(
    now: Date,
    settings: BillingSettings,
    failed: Failures
  ): Promise<
    Result<{
      generated: number;
      emailed: number;
      whatsAppSent: number;
    }>
  > {
    const customers = await this.billableCustomers.listBillable();
    if (customers.isFailure) return Result.fail(customers.error!);

    let generated = 0;
    let emailed = 0;
    let whatsAppSent = 0;
    for (const customer of customers.value) {
      const cycle = BillingCycle.openAt(
        now,
        customer.paymentDay,
        settings
      );
      if (cycle === null) continue;
      if (!cycle.covers(new Date(customer.firstServiceStart)))
        continue;

      const id = customer.customerId;
      const customerId = CustomerId.parse(id);
      if (customerId.isFailure) {
        failed.push({ id, error: customerId.error! });
        continue;
      }

      const existing = await this.billRepository.count({
        customerId: customerId.value,
        period: cycle.period
      });
      if (existing.isFailure) {
        failed.push({ id, error: existing.error! });
        continue;
      }
      if (existing.value > 0) continue;

      const bill = await this.generateBillUseCase.execute({
        customerId: id,
        year: cycle.period.year,
        month: cycle.period.month,
        issueDate: now.toISOString(),
        dueDate: cycle.dueDate.toISOString(),
        proration: {
          billingMode: settings.billingMode,
          previousIssueDay: isoDay(cycle.previousIssueDay)
        }
      });
      if (bill.isFailure) {
        failed.push({ id, error: bill.error! });
        continue;
      }
      generated++;

      // BIL-320, BIL-325: a bill that could not be sent is still issued.
      const email = await this.sendBillEmail.execute({
        billId: bill.value.id
      });
      if (email.isFailure) {
        failed.push({ id: bill.value.id, error: email.error! });
      } else if (email.value.sent) {
        emailed++;
      }

      const template = settings.billWhatsAppTemplate;
      if (template === null) continue;
      const whatsApp = await this.sendBillWhatsApp.execute({
        billId: bill.value.id,
        templateName: template
      });
      if (whatsApp.isFailure) {
        failed.push({ id: bill.value.id, error: whatsApp.error! });
      } else if (whatsApp.value.sent) {
        whatsAppSent++;
      }
    }
    return Result.ok({ generated, emailed, whatsAppSent });
  }
}
