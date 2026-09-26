// Source: src/domain/billing/value-objects/BankAccountDetails.ts

import { describe, it, expect } from '@jest/globals';
import {
  BankAccountDetails,
  BankAccountType
} from '../../../../src/domain/billing';

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    bankName: 'Bancolombia',
    accountType: BankAccountType.SAVINGS,
    accountNumber: '39500002227',
    ...overrides
  } as Parameters<typeof BankAccountDetails.create>[0];
}

describe('BankAccountDetails', () => {
  it('[BIL-260] builds details and trims the bank name and number', () => {
    const result = BankAccountDetails.create(
      makeProps({
        bankName: ' Bancolombia ',
        accountNumber: ' 395-000-02227 '
      })
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value.bankName).toBe('Bancolombia');
    expect(result.value.accountNumber).toBe('395-000-02227');
    expect(result.value.accountType).toBe(BankAccountType.SAVINGS);
  });

  it('[BIL-260] rejects an empty bank name', () => {
    const result = BankAccountDetails.create(
      makeProps({ bankName: ' ' })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('bankName cannot be empty');
  });

  it('[BIL-260] rejects a bank name over 100 characters', () => {
    const result = BankAccountDetails.create(
      makeProps({ bankName: 'x'.repeat(101) })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/cannot exceed 100/);
  });

  it('[BIL-260] rejects an unknown account type', () => {
    const result = BankAccountDetails.create(
      makeProps({ accountType: 'NEQUI' })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Invalid accountType "NEQUI"');
  });

  it.each([
    '123',
    'ABC12345',
    '12345678901234567890123456789012',
    '-1234'
  ])('[BIL-260] rejects account number %p', (accountNumber) => {
    const result = BankAccountDetails.create(
      makeProps({ accountNumber })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^accountNumber must be/);
  });

  it('is equal to another with the same values', () => {
    const a = BankAccountDetails.create(makeProps()).value;
    const b = BankAccountDetails.create(makeProps()).value;

    expect(a.equals(b)).toBe(true);
  });
});
