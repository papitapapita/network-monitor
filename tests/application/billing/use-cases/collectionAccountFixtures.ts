import { jest } from '@jest/globals';
import {
  IBankAccountRepository,
  ICollectionAccountRepository
} from '../../../../src/domain/billing/repository';
import {
  BankAccount,
  BankAccountDetails,
  BankAccountType,
  CollectionAccount,
  CollectionAccountLineItem,
  CollectionAccountStatus
} from '../../../../src/domain/billing';
import {
  BankAccountId,
  CollectionAccountId
} from '../../../../src/domain/shared/ids';
import { Money } from '../../../../src/domain/shared/value-objects';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

export const ACCOUNT_UUID = '550e8400-e29b-41d4-a716-446655440000';
export const NOW = new Date('2026-09-25T15:00:00.000Z');

export function makeLogger(): jest.Mocked<ILogger> {
  const child: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn(),
    setLevel: jest.fn()
  };
  child.child.mockReturnValue(child);
  return child;
}

export function makeCollectionAccountRepo(): jest.Mocked<ICollectionAccountRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn()
  };
}

export const BANK_ACCOUNT_UUID =
  '880e8400-e29b-41d4-a716-446655440003';

export function makeBankAccountDetails(
  overrides: Partial<{
    bankName: string;
    accountType: BankAccountType;
    accountNumber: string;
  }> = {}
): BankAccountDetails {
  return BankAccountDetails.create({
    bankName: 'Bancolombia',
    accountType: BankAccountType.SAVINGS,
    accountNumber: '39500002227',
    ...overrides
  }).value;
}

export function makeBankAccount(
  id: string = BANK_ACCOUNT_UUID,
  details: BankAccountDetails = makeBankAccountDetails()
): BankAccount {
  return BankAccount.reconstitute(BankAccountId.parse(id).value, {
    details,
    createdAt: NOW,
    updatedAt: NOW
  });
}

export function makeBankAccountRepo(): jest.Mocked<IBankAccountRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn()
  };
}

export function makeCollectionAccount(
  status: CollectionAccountStatus = CollectionAccountStatus.PENDING,
  code: number | null = 7
): CollectionAccount {
  return CollectionAccount.reconstitute(
    CollectionAccountId.parse(ACCOUNT_UUID).value,
    {
      code,
      status,
      customerId: null,
      customerName: 'María López',
      customerDocument: '1098765432',
      customerPhone: '3001234567',
      customerEmail: null,
      customerAddress: 'Cra 27 # 45-12',
      lineItems: [
        CollectionAccountLineItem.create({
          description: 'Cámara IP 4MP',
          unitPrice: Money.create(185000).value,
          quantity: 4
        }).value
      ],
      paymentAccounts: [makeBankAccountDetails()],
      issueDate: NOW,
      dueDate: null,
      notes: null,
      paidAt: status === CollectionAccountStatus.PAID ? NOW : null,
      cancelledAt:
        status === CollectionAccountStatus.CANCELLED ? NOW : null,
      createdBy: null,
      createdAt: NOW,
      updatedAt: NOW
    }
  );
}
