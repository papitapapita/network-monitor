// Source: src/application/billing/use-cases/MarkCollectionAccountPaidUseCase.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MarkCollectionAccountPaidUseCase } from '../../../../src/application/billing/use-cases/MarkCollectionAccountPaidUseCase';
import {
  CollectionAccount,
  CollectionAccountStatus
} from '../../../../src/domain/billing';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  ACCOUNT_UUID,
  makeCollectionAccount,
  makeCollectionAccountRepo,
  makeLogger
} from './collectionAccountFixtures';

describe('MarkCollectionAccountPaidUseCase', () => {
  let repo: ReturnType<typeof makeCollectionAccountRepo>;
  let useCase: MarkCollectionAccountPaidUseCase;

  beforeEach(() => {
    repo = makeCollectionAccountRepo();
    repo.save.mockImplementation(async (account: CollectionAccount) =>
      Result.ok(account)
    );
    useCase = new MarkCollectionAccountPaidUseCase(
      repo,
      makeLogger()
    );
  });

  it('[BIL-221] moves a PENDING account to PAID and saves it', async () => {
    repo.findById.mockResolvedValue(
      Result.ok(makeCollectionAccount())
    );

    const result = await useCase.execute({ id: ACCOUNT_UUID });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('PAID');
    expect(result.value.paidAt).not.toBeNull();
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('[BIL-221] refuses a PAID account without saving', async () => {
    repo.findById.mockResolvedValue(
      Result.ok(makeCollectionAccount(CollectionAccountStatus.PAID))
    );

    const result = await useCase.execute({ id: ACCOUNT_UUID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      'Cannot mark a PAID collection account as paid'
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('fails when the account does not exist', async () => {
    repo.findById.mockResolvedValue(Result.ok(null));

    const result = await useCase.execute({ id: ACCOUNT_UUID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      `Collection account not found: ${ACCOUNT_UUID}`
    );
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({ id: 'nope' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^Invalid collection account ID/);
  });

  it('surfaces a persistence failure', async () => {
    repo.findById.mockResolvedValue(
      Result.ok(makeCollectionAccount())
    );
    repo.save.mockResolvedValue(Result.fail('connection lost'));

    const result = await useCase.execute({ id: ACCOUNT_UUID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      'Failed to persist collection account: connection lost'
    );
  });
});
