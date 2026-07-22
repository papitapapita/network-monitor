import { CustomerId } from 'domain/shared/ids';
import { BillingPeriod } from 'domain/billing';
import { IBillRepository } from 'domain/billing/repository';
import {
  ContractedService,
  ContractedServiceStatus
} from 'domain/customers';
import { IContractedServiceRepository } from 'domain/customers/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  GenerateBillsForPeriodRequestDTO,
  BulkGenerateBillsResponseDTO
} from '../dtos';
import { GenerateBillUseCase } from './GenerateBillUseCase';

export class GenerateBillsForPeriodUseCase extends UseCase<
  GenerateBillsForPeriodRequestDTO,
  BulkGenerateBillsResponseDTO
> {
  constructor(
    private readonly generateBillUseCase: GenerateBillUseCase,
    private readonly billRepository: IBillRepository,
    private readonly contractedServiceRepository: IContractedServiceRepository,
    logger: ILogger
  ) {
    super(logger, 'GenerateBillsForPeriodUseCase');
  }

  protected async executeImpl(
    request: GenerateBillsForPeriodRequestDTO
  ): Promise<Result<BulkGenerateBillsResponseDTO>> {
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

    const servicesResult =
      await this.contractedServiceRepository.findByStatus(
        ContractedServiceStatus.ACTIVE
      );
    if (servicesResult.isFailure) {
      return this.fail(servicesResult.error!);
    }

    const customerIds = this.uniqueCustomerIds(servicesResult.value);

    const generated: BulkGenerateBillsResponseDTO['generated'] = [];
    const skipped: BulkGenerateBillsResponseDTO['skipped'] = [];
    const failed: BulkGenerateBillsResponseDTO['failed'] = [];

    for (const customerId of customerIds) {
      const raw = customerId.toString();

      const existsResult =
        await this.billRepository.existsForCustomerAndPeriod(
          customerId,
          period
        );
      if (existsResult.isFailure) {
        failed.push({ customerId: raw, error: existsResult.error! });
        continue;
      }
      if (existsResult.value) {
        skipped.push({
          customerId: raw,
          reason: `A bill already exists for customer ${raw} for period ${period.toString()}`
        });
        continue;
      }

      const genResult = await this.generateBillUseCase.execute({
        customerId: raw,
        year: request.year,
        month: request.month,
        issueDate: request.issueDate,
        dueDate: request.dueDate
      });

      if (genResult.isFailure) {
        failed.push({ customerId: raw, error: genResult.error });
        continue;
      }

      generated.push(genResult.value);
    }

    return this.ok({
      period: period.toString(),
      generated,
      skipped,
      failed
    });
  }

  private uniqueCustomerIds(
    services: ContractedService[]
  ): CustomerId[] {
    const seen = new Map<string, CustomerId>();
    for (const service of services) {
      const raw = service.customerId.toString();
      if (!seen.has(raw)) {
        seen.set(raw, service.customerId);
      }
    }
    return Array.from(seen.values());
  }
}
