import { ContractedServiceId } from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import {
  Bill,
  BillLineItem,
  BillingMode,
  BillingPeriod,
  BillStatus,
  ServicePeriod
} from 'domain/billing';
import { IBillRepository } from 'domain/billing/repository';
import {
  ContractedService,
  ContractedServiceStatus
} from 'domain/customers';
import {
  IServicePlanRepository,
  IContractedServiceRepository
} from 'domain/customers/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { BillMapper } from '../mappers';
import { GenerateBillRequestDTO, BillResponseDTO } from '../dtos';

const DEFAULT_DUE_DAYS = 15;

interface Proration {
  billingMode: BillingMode;
  previousIssueDay: Date;
}

// One bill per service and period (BIL-007): a customer with several
// services gets a bill for each, due on that service's own payment day.
export class GenerateBillUseCase extends UseCase<
  GenerateBillRequestDTO,
  BillResponseDTO
> {
  constructor(
    private readonly billRepository: IBillRepository,
    private readonly contractedServiceRepository: IContractedServiceRepository,
    private readonly servicePlanRepository: IServicePlanRepository,
    logger: ILogger
  ) {
    super(logger, 'GenerateBillUseCase');
  }

  protected async beforeExecute(
    request: GenerateBillRequestDTO
  ): Promise<Result<void> | null> {
    if (
      !request.contractedServiceId ||
      request.contractedServiceId.trim().length === 0
    ) {
      return Result.fail('contractedServiceId is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GenerateBillRequestDTO
  ): Promise<Result<BillResponseDTO>> {
    const serviceIdResult = ContractedServiceId.parse(
      request.contractedServiceId.trim()
    );
    if (serviceIdResult.isFailure) {
      return this.fail(
        `Invalid contractedServiceId: ${serviceIdResult.error}`
      );
    }
    const serviceId = serviceIdResult.value;

    const periodResult = BillingPeriod.create(
      request.year,
      request.month
    );
    if (periodResult.isFailure) {
      return this.fail(
        `Invalid billing period: ${periodResult.error}`
      );
    }
    const period = periodResult.value;

    const datesResult = this.resolveDates(
      request.issueDate,
      request.dueDate
    );
    if (datesResult.isFailure) {
      return this.fail(datesResult.error!);
    }
    const { issueDate, dueDate } = datesResult.value;

    const prorationResult = this.resolveProration(request.proration);
    if (prorationResult.isFailure) {
      return this.fail(prorationResult.error!);
    }
    const proration = prorationResult.value;

    const serviceResult =
      await this.contractedServiceRepository.findById(serviceId);
    if (serviceResult.isFailure) {
      return this.fail(serviceResult.error!);
    }
    const service = serviceResult.value;
    if (service === null) {
      return this.fail(
        `Contracted service not found: ${request.contractedServiceId}`
      );
    }
    if (service.status !== ContractedServiceStatus.ACTIVE) {
      return this.fail(
        'Contracted service is not active and cannot be billed'
      );
    }

    const duplicateCheck =
      await this.billRepository.existsForServiceAndPeriod(
        serviceId,
        period
      );
    if (duplicateCheck.isFailure) {
      return this.fail(duplicateCheck.error!);
    }
    if (duplicateCheck.value) {
      return this.fail(
        `A bill already exists for service ${request.contractedServiceId} for period ${period.toString()}`
      );
    }

    const lineItemResult = await this.buildLineItem(
      period,
      service,
      proration
    );
    if (lineItemResult.isFailure) {
      return this.fail(lineItemResult.error!);
    }
    if (lineItemResult.value === null) {
      return this.fail(
        `Service has nothing to bill for period ${period.toString()}`
      );
    }

    const billResult = Bill.create({
      customerId: service.customerId,
      period,
      lineItems: [lineItemResult.value],
      issueDate,
      dueDate
    });
    if (billResult.isFailure) {
      return this.fail(billResult.error!);
    }

    const saveResult = await this.billRepository.save(
      billResult.value
    );
    if (saveResult.isFailure) {
      return this.fail(`Failed to persist bill: ${saveResult.error}`);
    }

    return this.ok(BillMapper.toDTO(saveResult.value));
  }

  private resolveDates(
    issueDateRaw?: string,
    dueDateRaw?: string
  ): Result<{ issueDate: Date; dueDate: Date }> {
    let issueDate: Date;
    if (issueDateRaw !== undefined) {
      issueDate = new Date(issueDateRaw);
      if (isNaN(issueDate.getTime())) {
        return Result.fail('issueDate is not a valid date');
      }
    } else {
      issueDate = new Date();
    }

    let dueDate: Date;
    if (dueDateRaw !== undefined) {
      dueDate = new Date(dueDateRaw);
      if (isNaN(dueDate.getTime())) {
        return Result.fail('dueDate is not a valid date');
      }
    } else {
      dueDate = new Date(
        issueDate.getTime() + DEFAULT_DUE_DAYS * 24 * 60 * 60 * 1000
      );
    }

    return Result.ok({ issueDate, dueDate });
  }

  private resolveProration(
    raw: GenerateBillRequestDTO['proration']
  ): Result<Proration | null> {
    if (raw === undefined) return Result.ok(null);

    const modes = Object.values(BillingMode) as string[];
    if (!modes.includes(raw.billingMode)) {
      return Result.fail(
        `billingMode must be one of ${modes.join(', ')}`
      );
    }
    const previousIssueDay = new Date(
      `${raw.previousIssueDay}T00:00:00Z`
    );
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(raw.previousIssueDay) ||
      isNaN(previousIssueDay.getTime())
    ) {
      return Result.fail(
        'previousIssueDay must be a YYYY-MM-DD date'
      );
    }
    return Result.ok({
      billingMode: raw.billingMode as BillingMode,
      previousIssueDay
    });
  }

  // Whether the service is on a live bill for the month before `period`.
  private async billedLastPeriod(
    service: ContractedService,
    period: BillingPeriod
  ): Promise<Result<boolean>> {
    const previous =
      period.month === 1
        ? BillingPeriod.create(period.year - 1, 12)
        : BillingPeriod.create(period.year, period.month - 1);
    if (previous.isFailure) return Result.ok(false);

    const bills = await this.billRepository.findAll({
      contractedServiceId: service.id,
      period: previous.value
    });
    if (bills.isFailure) return Result.fail(bills.error!);

    return Result.ok(
      bills.value.some((bill) => bill.status !== BillStatus.CANCELLED)
    );
  }

  // Null when proration leaves nothing to charge in `period`.
  private async buildLineItem(
    period: BillingPeriod,
    service: ContractedService,
    proration: Proration | null
  ): Promise<Result<BillLineItem | null>> {
    let billedLastPeriod = false;
    if (proration?.billingMode === BillingMode.ADVANCE) {
      const billed = await this.billedLastPeriod(service, period);
      if (billed.isFailure) return Result.fail(billed.error!);
      billedLastPeriod = billed.value;
    }

    const servicePeriod =
      proration === null
        ? ServicePeriod.ofPeriod(period)
        : ServicePeriod.forAutomaticBill({
            period,
            billingMode: proration.billingMode,
            serviceStart: service.startDate,
            previousIssueDay: proration.previousIssueDay,
            billedLastPeriod
          });
    if (servicePeriod === null) return Result.ok(null);

    const planResult = await this.servicePlanRepository.findById(
      service.servicePlanId
    );
    if (planResult.isFailure) {
      return Result.fail(planResult.error!);
    }

    const plan = planResult.value;
    if (plan === null) {
      // Data integrity issue, not a client error — fail the whole run
      // rather than silently dropping the line item.
      return Result.fail(
        `Data integrity error: service plan ${service.servicePlanId.toString()} referenced by contracted service ${service.id.toString()} does not exist`
      );
    }

    const priceResult = Money.create(plan.monthlyPrice);
    if (priceResult.isFailure) {
      return Result.fail(priceResult.error!);
    }

    return BillLineItem.create({
      contractedServiceId: service.id,
      servicePlanId: plan.id,
      planName: plan.name,
      monthlyPrice: priceResult.value,
      amount:
        proration === null
          ? priceResult.value
          : servicePeriod.chargeFor(priceResult.value),
      servicePeriod
    });
  }
}
