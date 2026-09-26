// Source: src/application/billing/use-cases/ListBankAccountsUseCase.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ListBankAccountsUseCase } from '../../../../src/application/billing/use-cases/ListBankAccountsUseCase';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  BANK_ACCOUNT_UUID,
  makeBankAccount,
  makeBankAccountRepo,
  makeLogger
} from './collectionAccountFixtures';

describe('ListBankAccountsUseCase', () => {
  let repo: ReturnType<typeof makeBankAccountRepo>;
  let useCase: ListBankAccountsUseCase;

  beforeEach(() => {
    repo = makeBankAccountRepo();
    useCase = new ListBankAccountsUseCase(repo, makeLogger());
  });

  it('[BIL-264] returns every account with its label', async () => {
    repo.findAll.mockResolvedValue(Result.ok([makeBankAccount()]));

    const result = await useCase.execute();

    expect(result.isSuccess).toBe(true);
    expect(result.value.bankAccounts).toHaveLength(1);
    expect(result.value.bankAccounts[0].id).toBe(BANK_ACCOUNT_UUID);
    expect(result.value.bankAccounts[0].label).toBe(
      'Bancolombia · Ahorros · 39500002227'
    );
  });

  it('surfaces a repository failure', async () => {
    repo.findAll.mockResolvedValue(Result.fail('connection lost'));

    const result = await useCase.execute();

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('connection lost');
  });
});
