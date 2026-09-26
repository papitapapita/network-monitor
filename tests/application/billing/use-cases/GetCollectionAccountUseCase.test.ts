// Source: src/application/billing/use-cases/GetCollectionAccountUseCase.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { GetCollectionAccountUseCase } from '../../../../src/application/billing/use-cases/GetCollectionAccountUseCase';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  ACCOUNT_UUID,
  makeCollectionAccount,
  makeCollectionAccountRepo,
  makeLogger
} from './collectionAccountFixtures';

describe('GetCollectionAccountUseCase', () => {
  let repo: ReturnType<typeof makeCollectionAccountRepo>;
  let useCase: GetCollectionAccountUseCase;

  beforeEach(() => {
    repo = makeCollectionAccountRepo();
    useCase = new GetCollectionAccountUseCase(repo, makeLogger());
  });

  it('returns the account as a DTO with its formatted number', async () => {
    repo.findById.mockResolvedValue(
      Result.ok(makeCollectionAccount())
    );

    const result = await useCase.execute({ id: ACCOUNT_UUID });

    expect(result.isSuccess).toBe(true);
    expect(result.value.id).toBe(ACCOUNT_UUID);
    expect(result.value.number).toBe('CC-0007');
    expect(result.value.total).toBe(740000);
  });

  it('fails when the id is empty', async () => {
    const result = await useCase.execute({ id: ' ' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Collection account ID is required');
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({ id: 'nope' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^Invalid collection account ID/);
  });

  it('fails when the account does not exist', async () => {
    repo.findById.mockResolvedValue(Result.ok(null));

    const result = await useCase.execute({ id: ACCOUNT_UUID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      `Collection account not found: ${ACCOUNT_UUID}`
    );
  });
});
