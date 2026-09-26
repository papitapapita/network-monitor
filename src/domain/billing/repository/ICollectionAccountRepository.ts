import { CollectionAccountId, CustomerId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { CollectionAccount } from '../aggregates';
import { CollectionAccountStatus } from '../enums';

export interface CollectionAccountFilters {
  customerId?: CustomerId;
  status?: CollectionAccountStatus;
}

export interface ICollectionAccountRepository {
  save(
    collectionAccount: CollectionAccount
  ): Promise<Result<CollectionAccount>>;
  findById(
    id: CollectionAccountId
  ): Promise<Result<CollectionAccount | null>>;
  findAll(
    filters?: CollectionAccountFilters,
    limit?: number,
    offset?: number
  ): Promise<Result<CollectionAccount[]>>;
  count(filters?: CollectionAccountFilters): Promise<Result<number>>;
}
