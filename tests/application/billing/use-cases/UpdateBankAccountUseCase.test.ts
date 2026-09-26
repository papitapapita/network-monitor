// Source: src/application/billing/use-cases/UpdateBankAccountUseCase.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { UpdateBankAccountUseCase } from '../../../../src/application/billing/use-cases/UpdateBankAccountUseCase';
import { BankAccount } from '../../../../src/domain/billing';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  BANK_ACCOUNT_UUID,
  makeBankAccount,
  makeBankAccountRepo,
  makeLogger
} from './collectionAccountFixtures';

describe('UpdateBankAccountUseCase', () => {
  let repo: ReturnType<typeof makeBankAccountRepo>;
  let useCase: UpdateBankAccountUseCase;

  beforeEach(() => {
    repo = makeBankAccountRepo();
    repo.findById.mockResolvedValue(Result.ok(makeBankAccount()));
    repo.save.mockImplementation(async (account: BankAccount) =>
      Result.ok(account)
    );
    useCase = new UpdateBankAccountUseCase(repo, makeLogger());
  });

  it('changes only the fields supplied', async () => {
    const result = await useCase.execute({
      id: BANK_ACCOUNT_UUID,
      accountType: 'CHECKING'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.bankName).toBe('Bancolombia');
    expect(result.value.accountType).toBe('CHECKING');
    expect(result.value.accountNumber).toBe('39500002227');
  });

  it('[BIL-260] rejects an invalid new account number without saving', async () => {
    const result = await useCase.execute({
      id: BANK_ACCOUNT_UUID,
      accountNumber: '12'
    });

    expect(result.isFailure).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('[BIL-260] rejects an unknown account type', async () => {
    const result = await useCase.execute({
      id: BANK_ACCOUNT_UUID,
      accountType: 'NEQUI'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Invalid accountType "NEQUI"');
  });

  it('fails when the account does not exist', async () => {
    repo.findById.mockResolvedValue(Result.ok(null));

    const result = await useCase.execute({
      id: BANK_ACCOUNT_UUID,
      bankName: 'Davivienda'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      `Bank account not found: ${BANK_ACCOUNT_UUID}`
    );
  });
});
