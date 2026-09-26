// Source: src/application/billing/use-cases/ListCollectionAccountsUseCase.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ListCollectionAccountsUseCase } from '../../../../src/application/billing/use-cases/ListCollectionAccountsUseCase';
import { CollectionAccountStatus } from '../../../../src/domain/billing';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  makeCollectionAccount,
  makeCollectionAccountRepo,
  makeLogger
} from './collectionAccountFixtures';

const CUSTOMER_UUID = '660e8400-e29b-41d4-a716-446655440001';

describe('ListCollectionAccountsUseCase', () => {
  let repo: ReturnType<typeof makeCollectionAccountRepo>;
  let useCase: ListCollectionAccountsUseCase;

  beforeEach(() => {
    repo = makeCollectionAccountRepo();
    repo.findAll.mockResolvedValue(
      Result.ok([makeCollectionAccount()])
    );
    repo.count.mockResolvedValue(Result.ok(1));
    useCase = new ListCollectionAccountsUseCase(repo, makeLogger());
  });

  it('[BIL-240] defaults to 20 rows from offset 0', async () => {
    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(repo.findAll).toHaveBeenCalledWith({}, 20, 0);
    expect(result.value.collectionAccounts).toHaveLength(1);
    expect(result.value.hasMore).toBe(false);
  });

  it('[BIL-240] caps the limit at 100', async () => {
    await useCase.execute({ limit: 500 });

    expect(repo.findAll).toHaveBeenCalledWith({}, 100, 0);
  });

  it('[BIL-240] filters by customer and status (case-insensitive)', async () => {
    await useCase.execute({
      customerId: CUSTOMER_UUID,
      status: 'paid'
    });

    const [filters] = repo.findAll.mock.calls[0];
    expect(filters!.customerId!.toString()).toBe(CUSTOMER_UUID);
    expect(filters!.status).toBe(CollectionAccountStatus.PAID);
  });

  it('[BIL-240] rejects an unknown status', async () => {
    const result = await useCase.execute({ status: 'OVERDUE' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Invalid status "OVERDUE"');
  });

  it('[BIL-240] rejects a malformed customerId', async () => {
    const result = await useCase.execute({ customerId: 'x' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^Invalid customerId/);
  });
});
