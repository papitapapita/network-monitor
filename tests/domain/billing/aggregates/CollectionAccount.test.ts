// Source: src/domain/billing/aggregates/CollectionAccount.ts

import { describe, it, expect } from '@jest/globals';
import {
  CollectionAccount,
  CollectionAccountStatus,
  CollectionAccountLineItem,
  CollectionAccountIssuedEvent,
  CollectionAccountPaidEvent,
  CollectionAccountCancelledEvent
} from '../../../../src/domain/billing';
import { CollectionAccountId } from '../../../../src/domain/shared/ids';
import { Money } from '../../../../src/domain/shared/value-objects';

const ISSUE_DATE = new Date('2026-09-25T15:00:00.000Z');
const DUE_DATE = new Date('2026-10-10T15:00:00.000Z');
const LATER = new Date('2026-09-30T15:00:00.000Z');

function makeLineItem(
  unitPrice: number = 185000,
  quantity: number = 1
): CollectionAccountLineItem {
  return CollectionAccountLineItem.create({
    description: 'Cámara IP 4MP',
    unitPrice: Money.create(unitPrice).value,
    quantity
  }).value;
}

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    customerId: null,
    customerName: 'María López',
    customerDocument: '1098765432',
    customerPhone: '3001234567',
    customerEmail: null,
    customerAddress: null,
    lineItems: [makeLineItem()],
    issueDate: ISSUE_DATE,
    dueDate: DUE_DATE,
    notes: null,
    createdBy: null,
    ...overrides
  } as Parameters<typeof CollectionAccount.create>[0];
}

function reconstitute(
  status: CollectionAccountStatus
): CollectionAccount {
  return CollectionAccount.reconstitute(
    CollectionAccountId.create(),
    {
      ...makeProps(),
      code: 1,
      status,
      paidAt: status === CollectionAccountStatus.PAID ? LATER : null,
      cancelledAt:
        status === CollectionAccountStatus.CANCELLED ? LATER : null,
      createdAt: ISSUE_DATE,
      updatedAt: ISSUE_DATE
    }
  );
}

describe('CollectionAccount', () => {
  describe('create', () => {
    it('[BIL-220] starts PENDING with no code, paidAt or cancelledAt', () => {
      const result = CollectionAccount.create(makeProps());

      expect(result.isSuccess).toBe(true);
      const account = result.value;
      expect(account.status).toBe(CollectionAccountStatus.PENDING);
      expect(account.code).toBeNull();
      expect(account.paidAt).toBeNull();
      expect(account.cancelledAt).toBeNull();
    });

    it('[BIL-224] raises CollectionAccountIssuedEvent with the total', () => {
      const account = CollectionAccount.create(
        makeProps({ lineItems: [makeLineItem(100, 3)] })
      ).value;

      expect(account.domainEvents).toHaveLength(1);
      const event = account
        .domainEvents[0] as CollectionAccountIssuedEvent;
      expect(event).toBeInstanceOf(CollectionAccountIssuedEvent);
      expect(event.customerName).toBe('María López');
      expect(event.total.toNumber()).toBe(300);
    });

    it('[BIL-200] rejects an empty customer name', () => {
      const result = CollectionAccount.create(
        makeProps({ customerName: '   ' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Customer name cannot be empty');
    });

    it('[BIL-200] rejects a customer name over 150 characters', () => {
      const result = CollectionAccount.create(
        makeProps({ customerName: 'x'.repeat(151) })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/cannot exceed 150/);
    });

    it.each([
      ['customerDocument', 21, 'Customer document'],
      ['customerPhone', 21, 'Customer phone'],
      ['customerEmail', 256, 'Customer email'],
      ['customerAddress', 256, 'Customer address']
    ])(
      '[BIL-203] rejects %s longer than its column',
      (field, length, label) => {
        const result = CollectionAccount.create(
          makeProps({ [field]: 'x'.repeat(length) })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toMatch(
          new RegExp(`^${label} cannot exceed`)
        );
      }
    );

    it('[BIL-210] rejects an empty line item list', () => {
      const result = CollectionAccount.create(
        makeProps({ lineItems: [] })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(
        'A collection account must have at least one line item'
      );
    });

    it('[BIL-205] rejects a due date before the issue date', () => {
      const result = CollectionAccount.create(
        makeProps({ dueDate: new Date('2026-09-01T00:00:00.000Z') })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('dueDate cannot be before issueDate');
    });

    it('[BIL-205] accepts no due date at all', () => {
      const result = CollectionAccount.create(
        makeProps({ dueDate: null })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.dueDate).toBeNull();
    });
  });

  describe('total', () => {
    it('[BIL-212] sums every line total', () => {
      const account = CollectionAccount.create(
        makeProps({
          lineItems: [
            makeLineItem(185000, 4),
            makeLineItem(350000, 1)
          ]
        })
      ).value;

      expect(account.total.toNumber()).toBe(1090000);
    });
  });

  describe('markPaid', () => {
    it('[BIL-221] moves a PENDING account to PAID and records paidAt', () => {
      const account = reconstitute(CollectionAccountStatus.PENDING);

      const result = account.markPaid(LATER);

      expect(result.isSuccess).toBe(true);
      expect(account.status).toBe(CollectionAccountStatus.PAID);
      expect(account.paidAt).toEqual(LATER);
    });

    it('[BIL-224] raises CollectionAccountPaidEvent', () => {
      const account = reconstitute(CollectionAccountStatus.PENDING);
      account.clearEvents();

      account.markPaid(LATER);

      expect(account.domainEvents).toHaveLength(1);
      const event = account
        .domainEvents[0] as CollectionAccountPaidEvent;
      expect(event).toBeInstanceOf(CollectionAccountPaidEvent);
      expect(event.paidAt).toEqual(LATER);
    });

    it.each([
      CollectionAccountStatus.PAID,
      CollectionAccountStatus.CANCELLED
    ])('[BIL-221] refuses to pay a %s account', (status) => {
      const account = reconstitute(status);

      const result = account.markPaid(LATER);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(
        `Cannot mark a ${status} collection account as paid`
      );
      expect(account.status).toBe(status);
    });
  });

  describe('cancel', () => {
    it('[BIL-222] moves a PENDING account to CANCELLED and records cancelledAt', () => {
      const account = reconstitute(CollectionAccountStatus.PENDING);

      const result = account.cancel(LATER);

      expect(result.isSuccess).toBe(true);
      expect(account.status).toBe(CollectionAccountStatus.CANCELLED);
      expect(account.cancelledAt).toEqual(LATER);
    });

    it('[BIL-224] raises CollectionAccountCancelledEvent', () => {
      const account = reconstitute(CollectionAccountStatus.PENDING);
      account.clearEvents();

      account.cancel(LATER);

      expect(account.domainEvents).toHaveLength(1);
      expect(account.domainEvents[0]).toBeInstanceOf(
        CollectionAccountCancelledEvent
      );
    });

    it.each([
      CollectionAccountStatus.PAID,
      CollectionAccountStatus.CANCELLED
    ])('[BIL-222] refuses to cancel a %s account', (status) => {
      const account = reconstitute(status);

      const result = account.cancel(LATER);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(
        `Cannot cancel a ${status} collection account`
      );
    });
  });

  describe('status/date consistency', () => {
    it('[BIL-223] a transition off a corrupt reconstituted state is refused', () => {
      const account = CollectionAccount.reconstitute(
        CollectionAccountId.create(),
        {
          ...makeProps(),
          code: 1,
          status: CollectionAccountStatus.PENDING,
          paidAt: null,
          cancelledAt: LATER,
          createdAt: ISSUE_DATE,
          updatedAt: ISSUE_DATE
        }
      );

      const result = account.markPaid(LATER);

      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(
        /Only a CANCELLED collection account/
      );
    });
  });

  describe('separation from service billing', () => {
    it('[BIL-225] has no OVERDUE state', () => {
      expect(Object.values(CollectionAccountStatus)).toEqual([
        'PENDING',
        'PAID',
        'CANCELLED'
      ]);
    });
  });
});
