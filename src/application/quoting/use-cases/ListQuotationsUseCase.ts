import { QuotationStatus } from 'domain/quoting';
import {
  IQuotationRepository,
  QuotationFilters
} from 'domain/quoting/repository';
import { CustomerId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { QuotationMapper } from '../mappers';
import {
  ListQuotationsQueryDTO,
  QuotationListResponseDTO
} from '../dtos';

export class ListQuotationsUseCase extends UseCase<
  ListQuotationsQueryDTO,
  QuotationListResponseDTO
> {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;

  constructor(
    private readonly quotationRepository: IQuotationRepository,
    logger: ILogger
  ) {
    super(logger, 'ListQuotationsUseCase');
  }

  protected async executeImpl(
    request: ListQuotationsQueryDTO
  ): Promise<Result<QuotationListResponseDTO>> {
    const filtersResult = this.buildFilters(request);
    if (filtersResult.isFailure) {
      return this.fail(filtersResult.error!);
    }
    const filters = filtersResult.value;

    const limit = Math.min(
      request.limit ?? ListQuotationsUseCase.DEFAULT_LIMIT,
      ListQuotationsUseCase.MAX_LIMIT
    );
    const offset = request.offset ?? 0;

    const quotationsResult = await this.quotationRepository.findAll(
      filters,
      limit,
      offset
    );
    if (quotationsResult.isFailure) {
      return this.fail(quotationsResult.error!);
    }

    const countResult = await this.quotationRepository.count(filters);
    if (countResult.isFailure) {
      return this.fail(countResult.error!);
    }

    return this.ok(
      QuotationMapper.toListDTO(
        quotationsResult.value,
        countResult.value,
        limit,
        offset
      )
    );
  }

  private buildFilters(
    request: ListQuotationsQueryDTO
  ): Result<QuotationFilters> {
    const filters: QuotationFilters = {};

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
      if (
        !Object.values(QuotationStatus).includes(
          status as QuotationStatus
        )
      ) {
        return Result.fail(`Invalid status "${request.status}"`);
      }
      filters.status = status as QuotationStatus;
    }

    return Result.ok(filters);
  }
}
