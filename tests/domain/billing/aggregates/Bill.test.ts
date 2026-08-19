// Source: src/domain/billing/aggregates/Bill.ts

import { describe, it, expect } from '@jest/globals';
import {
  Bill,
  BillStatus,
  BillLineItem,
  BillingPeriod,
  BillGeneratedEvent,
  BillPaidEvent,
  BillCancelledEvent,
  BillOverdueEvent
} from '../../../../src/domain/billing';
import {
  BillId,
  CustomerId,
  ContractedServiceId,
  ServicePlanId
} from '../../../../src/domain/shared/ids';
import { Money } from '../../../../src/domain/shared/value-objects';

const ISSUE_DATE = new Date('2024-03-01T00:00:00.000Z');
const DUE_DATE = new Date('2024-03-16T00:00:00.000Z');
const PAST_DUE_DATE = new Date('2020-01-01T00:00:00.000Z');
const FUTURE_NOW = new Date('2024-03-20T00:00:00.000Z');

function makeLineItem(
  overrides: Record<string, unknown> = {}
): BillLineItem {
  return BillLineItem.create({
    contractedServiceId: ContractedServiceId.create(),
    servicePlanId: ServicePlanId.create(),
    planName: 'Fiber 50/10',
    monthlyPrice: Money.create(19.99).value,
    ...overrides
  }).value;
}

function validProps(overrides: Record<string, unknown> = {}) {
  return {
    customerId: CustomerId.create(),
    period: BillingPeriod.create(2024, 3).value,
    lineItems: [makeLineItem()],
    issueDate: ISSUE_DATE,
    dueDate: DUE_DATE,
    ...overrides
  };
}

function reconstituteBill(
  status: BillStatus,
  overrides: Record<string, unknown> = {}
): Bill {
  return Bill.reconstitute(BillId.create(), {
    customerId: CustomerId.create(),
    period: BillingPeriod.create(2024, 3).value,
    status,
    lineItems: [makeLineItem()],
    issueDate: ISSUE_DATE,
    dueDate: DUE_DATE,
    paidAt: status === BillStatus.PAID ? ISSUE_DATE : null,
    createdAt: ISSUE_DATE,
    updatedAt: ISSUE_DATE,
    ...overrides
  });
}

describe('Bill', () => {
  describe('create()', () => {
    it('should fail with an empty lineItems array', () => {
      const result = Bill.create(validProps({ lineItems: [] }));
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('at least one line item');
    });

    it('should fail when dueDate is before issueDate', () => {
      const result = Bill.create(
        validProps({
          issueDate: new Date('2024-03-16T00:00:00.000Z'),
          dueDate: new Date('2024-03-01T00:00:00.000Z')
        })
      );
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'dueDate cannot be before issueDate'
      );
    });

    it('should default to PENDING status', () => {
      const bill = Bill.create(validProps()).value;
      expect(bill.status).toBe(BillStatus.PENDING);
    });

    it('should default paidAt to null', () => {
      const bill = Bill.create(validProps()).value;
      expect(bill.paidAt).toBeNull();
    });

    it('should emit a BillGeneratedEvent', () => {
      const bill = Bill.create(validProps()).value;
      expect(bill.domainEvents).toHaveLength(1);
      expect(bill.domainEvents[0]).toBeInstanceOf(BillGeneratedEvent);
    });

    it('should compute total as the exact cent-accurate sum of line items', () => {
      const bill = Bill.create(
        validProps({
          lineItems: [
            makeLineItem({ monthlyPrice: Money.create(19.99).value }),
            makeLineItem({ monthlyPrice: Money.create(39.99).value })
          ]
        })
      ).value;

      // Raw float addition of 19.99 + 39.99 drifts to 59.980000000000004;
      // cents-based Money.add must land exactly on 59.98.
      expect(bill.total.cents).toBe(5998);
      expect(bill.total.toNumber()).toBe(59.98);
    });

    it('should succeed with valid props', () => {
      const result = Bill.create(validProps());
      expect(result.isSuccess).toBe(true);
    });

    it('should allow dueDate equal to issueDate', () => {
      const result = Bill.create(
        validProps({ issueDate: ISSUE_DATE, dueDate: ISSUE_DATE })
      );
      expect(result.isSuccess).toBe(true);
    });
  });

  describe('markPaid()', () => {
    it('should succeed from PENDING, set paidAt, and emit BillPaidEvent', () => {
      const bill = reconstituteBill(BillStatus.PENDING);
      bill.clearEvents();

      const result = bill.markPaid();

      expect(result.isSuccess).toBe(true);
      expect(bill.status).toBe(BillStatus.PAID);
      expect(bill.paidAt).not.toBeNull();
      expect(bill.domainEvents[0]).toBeInstanceOf(BillPaidEvent);
    });

    it('should succeed from OVERDUE, set paidAt, and emit BillPaidEvent', () => {
      const bill = reconstituteBill(BillStatus.OVERDUE);
      bill.clearEvents();

      const result = bill.markPaid();

      expect(result.isSuccess).toBe(true);
      expect(bill.status).toBe(BillStatus.PAID);
      expect(bill.paidAt).not.toBeNull();
      expect(bill.domainEvents[0]).toBeInstanceOf(BillPaidEvent);
    });

    it('should fail from PAID (terminal)', () => {
      const bill = reconstituteBill(BillStatus.PAID);
      const result = bill.markPaid();
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot mark a PAID bill as paid'
      );
    });

    it('should fail from CANCELLED (terminal)', () => {
      const bill = reconstituteBill(BillStatus.CANCELLED);
      const result = bill.markPaid();
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot mark a CANCELLED bill as paid'
      );
    });
  });

  describe('cancel()', () => {
    it('should succeed from PENDING and emit BillCancelledEvent', () => {
      const bill = reconstituteBill(BillStatus.PENDING);
      bill.clearEvents();

      const result = bill.cancel();

      expect(result.isSuccess).toBe(true);
      expect(bill.status).toBe(BillStatus.CANCELLED);
      expect(bill.domainEvents[0]).toBeInstanceOf(BillCancelledEvent);
    });

    it('should succeed from OVERDUE and emit BillCancelledEvent', () => {
      const bill = reconstituteBill(BillStatus.OVERDUE);
      bill.clearEvents();

      const result = bill.cancel();

      expect(result.isSuccess).toBe(true);
      expect(bill.status).toBe(BillStatus.CANCELLED);
      expect(bill.domainEvents[0]).toBeInstanceOf(BillCancelledEvent);
    });

    it('should fail from PAID with a specific message', () => {
      const bill = reconstituteBill(BillStatus.PAID);
      const result = bill.cancel();
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Cannot cancel a paid bill');
    });

    it('should fail from CANCELLED (terminal)', () => {
      const bill = reconstituteBill(BillStatus.CANCELLED);
      const result = bill.cancel();
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot cancel an already cancelled bill'
      );
    });
  });

  describe('markOverdue()', () => {
    it('should succeed from PENDING when now is past dueDate', () => {
      // dueDate (03-16) is after issueDate (03-01) and before FUTURE_NOW
      // (03-20), so this is both "past due" and validate()-compatible.
      const bill = reconstituteBill(BillStatus.PENDING);
      bill.clearEvents();

      const result = bill.markOverdue(FUTURE_NOW);

      expect(result.isSuccess).toBe(true);
      expect(bill.status).toBe(BillStatus.OVERDUE);
      expect(bill.domainEvents[0]).toBeInstanceOf(BillOverdueEvent);
    });

    it('should fail from PENDING when now is before dueDate', () => {
      const bill = reconstituteBill(BillStatus.PENDING, {
        dueDate: new Date('2024-04-01T00:00:00.000Z')
      });

      const result = bill.markOverdue(ISSUE_DATE);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not past its due date');
    });

    it('should fail from PENDING when now equals dueDate', () => {
      const bill = reconstituteBill(BillStatus.PENDING, {
        dueDate: DUE_DATE
      });

      const result = bill.markOverdue(DUE_DATE);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not past its due date');
    });

    it('should fail from PAID', () => {
      const bill = reconstituteBill(BillStatus.PAID, {
        dueDate: PAST_DUE_DATE
      });
      const result = bill.markOverdue(FUTURE_NOW);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot mark a PAID bill as overdue'
      );
    });

    it('should fail from OVERDUE (already overdue)', () => {
      const bill = reconstituteBill(BillStatus.OVERDUE, {
        dueDate: PAST_DUE_DATE
      });
      const result = bill.markOverdue(FUTURE_NOW);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot mark a OVERDUE bill as overdue'
      );
    });

    it('should fail from CANCELLED', () => {
      const bill = reconstituteBill(BillStatus.CANCELLED, {
        dueDate: PAST_DUE_DATE
      });
      const result = bill.markOverdue(FUTURE_NOW);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot mark a CANCELLED bill as overdue'
      );
    });
  });
});
