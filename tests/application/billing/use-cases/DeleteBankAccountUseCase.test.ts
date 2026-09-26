// Source: src/application/billing/use-cases/DeleteBankAccountUseCase.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DeleteBankAccountUseCase } from '../../../../src/application/billing/use-cases/DeleteBankAccountUseCase';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  BANK_ACCOUNT_UUID,
  makeBankAccountRepo,
  makeLogger
} from './collectionAccountFixtures';

describe('DeleteBankAccountUseCase', () => {
  let repo: ReturnType<typeof makeBankAccountRepo>;
  let useCase: DeleteBankAccountUseCase;

  beforeEach(() => {
    repo = makeBankAccountRepo();
    useCase = new DeleteBankAccountUseCase(repo, makeLogger());
  });

  it('deletes the account', async () => {
    repo.delete.mockResolvedValue(Result.ok());

    const result = await useCase.execute({ id: BANK_ACCOUNT_UUID });

    expect(result.isSuccess).toBe(true);
    expect(repo.delete).toHaveBeenCalledTimes(1);
  });

  it('surfaces not-found from the repository', async () => {
    repo.delete.mockResolvedValue(
      Result.fail(`Bank account not found: ${BANK_ACCOUNT_UUID}`)
    );

    const result = await useCase.execute({ id: BANK_ACCOUNT_UUID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/);
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({ id: 'nope' });

    expect(result.isFailure).toBe(true);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
