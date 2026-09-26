// Source: src/domain/billing/aggregates/BankAccount.ts

import { describe, it, expect } from '@jest/globals';
import {
  BankAccount,
  BankAccountDetails,
  BankAccountType
} from '../../../../src/domain/billing';

function makeDetails(accountNumber: string = '39500002227') {
  return BankAccountDetails.create({
    bankName: 'Bancolombia',
    accountType: BankAccountType.SAVINGS,
    accountNumber
  }).value;
}

describe('BankAccount', () => {
  it('creates an account exposing its details', () => {
    const result = BankAccount.create(makeDetails());

    expect(result.isSuccess).toBe(true);
    expect(result.value.bankName).toBe('Bancolombia');
    expect(result.value.accountType).toBe(BankAccountType.SAVINGS);
    expect(result.value.accountNumber).toBe('39500002227');
  });

  it('replaces its details and bumps updatedAt', () => {
    const account = BankAccount.create(makeDetails()).value;
    const before = account.updatedAt;

    const result = account.updateDetails(makeDetails('11122233344'));

    expect(result.isSuccess).toBe(true);
    expect(account.accountNumber).toBe('11122233344');
    expect(account.updatedAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime()
    );
  });

  it('refuses missing details', () => {
    const result = BankAccount.create(
      undefined as unknown as BankAccountDetails
    );

    expect(result.isFailure).toBe(true);
  });
});
