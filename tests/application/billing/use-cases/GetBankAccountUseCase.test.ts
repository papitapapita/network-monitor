// Source: src/application/billing/use-cases/GetBankAccountUseCase.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { GetBankAccountUseCase } from '../../../../src/application/billing/use-cases/GetBankAccountUseCase';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  BANK_ACCOUNT_UUID,
  makeBankAccount,
  makeBankAccountRepo,
  makeLogger
} from './collectionAccountFixtures';

describe('GetBankAccountUseCase', () => {
  let repo: ReturnType<typeof makeBankAccountRepo>;
  let useCase: GetBankAccountUseCase;

  beforeEach(() => {
    repo = makeBankAccountRepo();
    useCase = new GetBankAccountUseCase(repo, makeLogger());
  });

  it('returns the account', async () => {
    repo.findById.mockResolvedValue(Result.ok(makeBankAccount()));

    const result = await useCase.execute({ id: BANK_ACCOUNT_UUID });

    expect(result.isSuccess).toBe(true);
    expect(result.value.accountNumber).toBe('39500002227');
  });

  it('fails when the account does not exist', async () => {
    repo.findById.mockResolvedValue(Result.ok(null));

    const result = await useCase.execute({ id: BANK_ACCOUNT_UUID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      `Bank account not found: ${BANK_ACCOUNT_UUID}`
    );
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({ id: 'nope' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^Invalid bank account ID/);
  });
});
