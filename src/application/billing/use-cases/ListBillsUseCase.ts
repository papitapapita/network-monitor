import { CustomerId } from 'domain/shared/ids';
import { BillStatus, BillingPeriod } from 'domain/billing';
import {
  IBillRepository,
  BillFilters
} from 'domain/billing/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { BillMapper } from '../mappers';
import { ListBillsQueryDTO, BillListResponseDTO } from '../dtos';

export class ListBillsUseCase extends UseCase<
  ListBillsQueryDTO,
  BillListResponseDTO
> {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;

  constructor(
    private readonly billRepository: IBillRepository,
    logger: ILogger
  ) {
    super(logger, 'ListBillsUseCase');
  }

  protected async executeImpl(
    request: ListBillsQueryDTO
  ): Promise<Result<BillListResponseDTO>> {
    const filtersResult = this.buildFilters(request);
    if (filtersResult.isFailure) {
      return this.fail(filtersResult.error!);
    }
    const filters = filtersResult.value;

    const limit = Math.min(
      request.limit ?? ListBillsUseCase.DEFAULT_LIMIT,
      ListBillsUseCase.MAX_LIMIT
    );
    const offset = request.offset ?? 0;

    const billsResult = await this.billRepository.findAll(
      filters,
      limit,
      offset
    );
    if (billsResult.isFailure) {
      return this.fail(billsResult.error!);
    }

    const countResult = await this.billRepository.count(filters);
    if (countResult.isFailure) {
      return this.fail(countResult.error!);
    }

    return this.ok(
      BillMapper.toListDTO(
        billsResult.value,
        countResult.value,
        limit,
        offset
      )
    );
  }

  private buildFilters(
    request: ListBillsQueryDTO
  ): Result<BillFilters> {
    const filters: BillFilters = {};

    if (request.customerId !== undefined) {
      const customerIdResult = CustomerId.parse(
        request.customerId.trim()
      );
      if (customerIdResult.isFailure) {
        return Result.fail(
          `Invalid customerId: ${customerIdResult.error}`
        );
      }
      filters.customerId = customerIdResult.value;
    }

    if (request.status !== undefined) {
      const status = request.status.toUpperCase();
      if (!Object.values(BillStatus).includes(status as BillStatus)) {
        return Result.fail(`Invalid status "${request.status}"`);
      }
      filters.status = status as BillStatus;
    }

    if (request.year !== undefined || request.month !== undefined) {
      if (request.year === undefined || request.month === undefined) {
        return Result.fail(
          'Both year and month are required to filter by period'
        );
      }
      const periodResult = BillingPeriod.create(
        request.year,
        request.month
      );
      if (periodResult.isFailure) {
        return Result.fail(
          `Invalid billing period: ${periodResult.error}`
        );
      }
      filters.period = periodResult.value;
    }

    return Result.ok(filters);
  }
}
