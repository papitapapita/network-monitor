import { Result } from 'domain/shared/core';
import { CustomerId } from 'domain/shared/ids';
import {
  BillingCycle,
  BillingSettings
} from 'domain/billing/value-objects';
import {
  IBillRepository,
  IBillingSettingsRepository
} from 'domain/billing/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IBillableCustomersQuery } from '../interfaces';
import {
  RunBillingCycleRequestDTO,
  BillingCycleRunResultDTO
} from '../dtos';
import { GenerateBillUseCase } from './GenerateBillUseCase';

type Failures = BillingCycleRunResultDTO['failed'];

// The daily billing run (BIL-284): marks unpaid bills overdue once their due
// date has passed, then issues the bills whose issue window is open. Does
// nothing while automatic billing is off. Safe to repeat: a period already
// billed — even cancelled — is never billed again by the run.
export class RunBillingCycleUseCase extends UseCase<
  RunBillingCycleRequestDTO,
  BillingCycleRunResultDTO
> {
  constructor(
    private readonly settingsRepository: IBillingSettingsRepository,
    private readonly billableCustomers: IBillableCustomersQuery,
    private readonly billRepository: IBillRepository,
    private readonly generateBillUseCase: GenerateBillUseCase,
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
        failed: []
      });
    }

    const failed: Failures = [];

    const overdue = await this.markOverdue(request.now, failed);
    if (overdue.isFailure) return this.fail(overdue.error!);

    const generated = await this.issueBills(
      request.now,
      settings,
      failed
    );
    if (generated.isFailure) return this.fail(generated.error!);

    return this.ok({
      automaticBillingEnabled: true,
      generated: generated.value,
      markedOverdue: overdue.value,
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

  private async issueBills(
    now: Date,
    settings: BillingSettings,
    failed: Failures
  ): Promise<Result<number>> {
    const customers = await this.billableCustomers.listBillable();
    if (customers.isFailure) return Result.fail(customers.error!);

    let generated = 0;
    for (const customer of customers.value) {
      const cycle = BillingCycle.openAt(
        now,
        customer.paymentDay,
        settings
      );
      if (cycle === null) continue;

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
        dueDate: cycle.dueDate.toISOString()
      });
      if (bill.isFailure) {
        failed.push({ id, error: bill.error! });
        continue;
      }
      generated++;
    }
    return Result.ok(generated);
  }
}
