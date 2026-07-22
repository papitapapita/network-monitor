import { CustomerId } from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import { Bill, BillLineItem, BillingPeriod } from 'domain/billing';
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

    const lineItemsResult = await this.buildLineItems(activeServices);
    if (lineItemsResult.isFailure) {
      return this.fail(lineItemsResult.error!);
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

  private async buildLineItems(
    services: ContractedService[]
  ): Promise<Result<BillLineItem[]>> {
    const lineItems: BillLineItem[] = [];

    for (const service of services) {
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
        monthlyPrice: priceResult.value
      });
      if (lineItemResult.isFailure) {
        return Result.fail(lineItemResult.error!);
      }

      lineItems.push(lineItemResult.value);
    }

    return Result.ok(lineItems);
  }
}
