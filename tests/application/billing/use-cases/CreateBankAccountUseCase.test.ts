// Source: src/application/billing/use-cases/CreateBankAccountUseCase.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { CreateBankAccountUseCase } from '../../../../src/application/billing/use-cases/CreateBankAccountUseCase';
import { BankAccount } from '../../../../src/domain/billing';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  makeBankAccountRepo,
  makeLogger
} from './collectionAccountFixtures';

describe('CreateBankAccountUseCase', () => {
  let repo: ReturnType<typeof makeBankAccountRepo>;
  let useCase: CreateBankAccountUseCase;

  beforeEach(() => {
    repo = makeBankAccountRepo();
    repo.save.mockImplementation(async (account: BankAccount) =>
      Result.ok(account)
    );
    useCase = new CreateBankAccountUseCase(repo, makeLogger());
  });

  it('[BIL-264] creates an account with a picker label', async () => {
    const result = await useCase.execute({
      bankName: 'Bancolombia',
      accountType: 'savings',
      accountNumber: '39500002227'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.accountType).toBe('SAVINGS');
    expect(result.value.label).toBe(
      'Bancolombia · Ahorros · 39500002227'
    );
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('[BIL-264] labels a checking account as Corriente', async () => {
    const result = await useCase.execute({
      bankName: 'Davivienda',
      accountType: 'CHECKING',
      accountNumber: '12345678'
    });

    expect(result.value.label).toBe(
      'Davivienda · Corriente · 12345678'
    );
  });

  it('[BIL-260] rejects an unknown account type', async () => {
    const result = await useCase.execute({
      bankName: 'Bancolombia',
      accountType: 'NEQUI',
      accountNumber: '39500002227'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Invalid accountType "NEQUI"');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('[BIL-260] rejects a malformed account number', async () => {
    const result = await useCase.execute({
      bankName: 'Bancolombia',
      accountType: 'SAVINGS',
      accountNumber: 'abc'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^accountNumber must be/);
  });

  it('[BIL-261] surfaces a duplicate reported by the repository', async () => {
    repo.save.mockResolvedValue(
      Result.fail(
        'A bank account with number 39500002227 at Bancolombia already exists'
      )
    );

    const result = await useCase.execute({
      bankName: 'Bancolombia',
      accountType: 'SAVINGS',
      accountNumber: '39500002227'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/already exists/);
  });
});
