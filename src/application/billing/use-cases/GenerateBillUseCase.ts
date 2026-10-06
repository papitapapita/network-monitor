import { CustomerId } from 'domain/shared/ids';
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
  ICustomerRepository,
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

export class GenerateBillUseCase extends UseCase<
  GenerateBillRequestDTO,
  BillResponseDTO
> {
  constructor(
    private readonly billRepository: IBillRepository,
    private readonly customerRepository: ICustomerRepository,
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
      !request.customerId ||
      request.customerId.trim().length === 0
    ) {
      return Result.fail('customerId is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GenerateBillRequestDTO
  ): Promise<Result<BillResponseDTO>> {
    const customerIdResult = CustomerId.parse(
      request.customerId.trim()
    );
    if (customerIdResult.isFailure) {
      return this.fail(
        `Invalid customerId: ${customerIdResult.error}`
      );
    }
    const customerId = customerIdResult.value;

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

    const customerExists =
      await this.customerRepository.exists(customerId);
    if (customerExists.isFailure) {
      return this.fail(customerExists.error!);
    }
    if (!customerExists.value) {
      return this.fail(`Customer not found: ${request.customerId}`);
    }

    const duplicateCheck =
      await this.billRepository.existsForCustomerAndPeriod(
        customerId,
        period
      );
    if (duplicateCheck.isFailure) {
      return this.fail(duplicateCheck.error!);
    }
    if (duplicateCheck.value) {
      return this.fail(
        `A bill already exists for customer ${request.customerId} for period ${period.toString()}`
      );
    }

    const servicesResult =
      await this.contractedServiceRepository.findByCustomerId(
        customerId
      );
    if (servicesResult.isFailure) {
      return this.fail(servicesResult.error!);
    }

    const activeServices = servicesResult.value.filter(
      (service) => service.status === ContractedServiceStatus.ACTIVE
    );
    if (activeServices.length === 0) {
      return this.fail(
        'Customer has no active contracted services for billing'
      );
    }

    const lineItemsResult = await this.buildLineItems(
      customerId,
      period,
      activeServices,
      proration
    );
    if (lineItemsResult.isFailure) {
      return this.fail(lineItemsResult.error!);
    }
    if (lineItemsResult.value.length === 0) {
      return this.fail(
        `Customer has no services to bill for period ${period.toString()}`
      );
    }

    const billResult = Bill.create({
      customerId,
      period,
      lineItems: lineItemsResult.value,
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

  // Services on a live bill for the month before `period`.
  private async billedLastPeriod(
    customerId: CustomerId,
    period: BillingPeriod
  ): Promise<Result<Set<string>>> {
    const previous =
      period.month === 1
        ? BillingPeriod.create(period.year - 1, 12)
        : BillingPeriod.create(period.year, period.month - 1);
    if (previous.isFailure) return Result.ok(new Set());

    const bills = await this.billRepository.findAll({
      customerId,
      period: previous.value
    });
    if (bills.isFailure) return Result.fail(bills.error!);

    const billed = new Set<string>();
    for (const bill of bills.value) {
      if (bill.status === BillStatus.CANCELLED) continue;
      for (const item of bill.lineItems) {
        billed.add(item.contractedServiceId.toString());
      }
    }
    return Result.ok(billed);
  }

  private async buildLineItems(
    customerId: CustomerId,
    period: BillingPeriod,
    services: ContractedService[],
    proration: Proration | null
  ): Promise<Result<BillLineItem[]>> {
    const lineItems: BillLineItem[] = [];

    let billedLastPeriod = new Set<string>();
    if (proration?.billingMode === BillingMode.ADVANCE) {
      const billed = await this.billedLastPeriod(customerId, period);
      if (billed.isFailure) return Result.fail(billed.error!);
      billedLastPeriod = billed.value;
    }

    for (const service of services) {
      const servicePeriod =
        proration === null
          ? ServicePeriod.ofPeriod(period)
          : ServicePeriod.forAutomaticBill({
              period,
              billingMode: proration.billingMode,
              serviceStart: service.startDate,
              previousIssueDay: proration.previousIssueDay,
              billedLastPeriod: billedLastPeriod.has(
                service.id.toString()
              )
            });
      if (servicePeriod === null) continue;

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

      const lineItemResult = BillLineItem.create({
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
      if (lineItemResult.isFailure) {
        return Result.fail(lineItemResult.error!);
      }

      lineItems.push(lineItemResult.value);
    }

    return Result.ok(lineItems);
  }
}
