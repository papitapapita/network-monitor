import { CollectionAccountStatus } from 'domain/billing';
import {
  ICollectionAccountRepository,
  CollectionAccountFilters
} from 'domain/billing/repository';
import { CustomerId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { CollectionAccountMapper } from '../mappers';
import {
  ListCollectionAccountsQueryDTO,
  CollectionAccountListResponseDTO
} from '../dtos';

export class ListCollectionAccountsUseCase extends UseCase<
  ListCollectionAccountsQueryDTO,
  CollectionAccountListResponseDTO
> {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;

  constructor(
    private readonly collectionAccountRepository: ICollectionAccountRepository,
    logger: ILogger
  ) {
    super(logger, 'ListCollectionAccountsUseCase');
  }

  protected async executeImpl(
    request: ListCollectionAccountsQueryDTO
  ): Promise<Result<CollectionAccountListResponseDTO>> {
    const filtersResult = this.buildFilters(request);
    if (filtersResult.isFailure) {
      return this.fail(filtersResult.error!);
    }
    const filters = filtersResult.value;

    const limit = Math.min(
      request.limit ?? ListCollectionAccountsUseCase.DEFAULT_LIMIT,
      ListCollectionAccountsUseCase.MAX_LIMIT
    );
    const offset = request.offset ?? 0;

    const findResult = await this.collectionAccountRepository.findAll(
      filters,
      limit,
      offset
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }

    const countResult =
      await this.collectionAccountRepository.count(filters);
    if (countResult.isFailure) {
      return this.fail(countResult.error!);
    }

    return this.ok(
      CollectionAccountMapper.toListDTO(
        findResult.value,
        countResult.value,
        limit,
        offset
      )
    );
  }

  private buildFilters(
    request: ListCollectionAccountsQueryDTO
  ): Result<CollectionAccountFilters> {
    const filters: CollectionAccountFilters = {};

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
        !Object.values(CollectionAccountStatus).includes(
          status as CollectionAccountStatus
        )
      ) {
        return Result.fail(`Invalid status "${request.status}"`);
      }
      filters.status = status as CollectionAccountStatus;
    }

    return Result.ok(filters);
  }
}
