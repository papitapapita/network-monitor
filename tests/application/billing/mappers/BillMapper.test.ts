// Source: src/application/billing/mappers/BillMapper.ts

import { describe, it, expect } from '@jest/globals';
import { BillMapper } from '../../../../src/application/billing/mappers';
import {
  Bill,
  BillStatus,
  BillingPeriod,
  BillLineItem
} from '../../../../src/domain/billing';
import {
  BillId,
  CustomerId,
  ContractedServiceId,
  ServicePlanId
} from '../../../../src/domain/shared/ids';
import { Money } from '../../../../src/domain/shared/value-objects';

const UUID = '550e8400-e29b-41d4-a716-446655440000';
const CUSTOMER_UUID = '550e8400-e29b-41d4-a716-446655440001';
const ISSUE_DATE = new Date('2024-03-01T00:00:00.000Z');
const DUE_DATE = new Date('2024-03-16T00:00:00.000Z');
const PAID_AT = new Date('2024-03-10T00:00:00.000Z');
const CREATED_AT = new Date('2024-02-28T00:00:00.000Z');
const UPDATED_AT = new Date('2024-03-10T00:00:00.000Z');

function makeBill(overrides: Record<string, unknown> = {}): Bill {
  return Bill.reconstitute(BillId.parse(UUID).value, {
    customerId: CustomerId.parse(CUSTOMER_UUID).value,
    period: BillingPeriod.create(2024, 3).value,
    status: BillStatus.PENDING,
    lineItems: [
      BillLineItem.create({
        contractedServiceId: ContractedServiceId.create(),
        servicePlanId: ServicePlanId.create(),
        planName: 'Fiber 50/10',
        monthlyPrice: Money.create(19.99).value
      }).value
    ],
    issueDate: ISSUE_DATE,
    dueDate: DUE_DATE,
    paidAt: null,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides
  });
}

describe('BillMapper.toDTO', () => {
  it('should serialize ids, period, status, total, and line items', () => {
    const bill = makeBill();

    const dto = BillMapper.toDTO(bill);

    expect(dto.id).toBe(UUID);
    expect(dto.customerId).toBe(CUSTOMER_UUID);
    expect(dto.period).toBe('2024-03');
    expect(dto.status).toBe('PENDING');
    expect(dto.lineItems).toEqual([
      {
        contractedServiceId: expect.any(String),
        servicePlanId: expect.any(String),
        planName: 'Fiber 50/10',
        monthlyPrice: 19.99
      }
    ]);
  });

  it('should represent total as a plain number', () => {
    const bill = makeBill();
    const dto = BillMapper.toDTO(bill);
    expect(typeof dto.total).toBe('number');
    expect(dto.total).toBe(19.99);
  });

  it('should represent the period as a "YYYY-MM" string', () => {
    const bill = makeBill({ period: BillingPeriod.create(2024, 1).value });
    const dto = BillMapper.toDTO(bill);
    expect(dto.period).toBe('2024-01');
  });

  it('should serialize issueDate, dueDate, createdAt, updatedAt as ISO strings', () => {
    const bill = makeBill();
    const dto = BillMapper.toDTO(bill);
    expect(dto.issueDate).toBe(ISSUE_DATE.toISOString());
    expect(dto.dueDate).toBe(DUE_DATE.toISOString());
    expect(dto.createdAt).toBe(CREATED_AT.toISOString());
    expect(dto.updatedAt).toBe(UPDATED_AT.toISOString());
  });

  it('should serialize paidAt as null when the bill is not paid', () => {
    const bill = makeBill();
    const dto = BillMapper.toDTO(bill);
    expect(dto.paidAt).toBeNull();
  });

  it('should serialize paidAt as an ISO string when the bill is paid', () => {
    const bill = makeBill({ status: BillStatus.PAID, paidAt: PAID_AT });
    const dto = BillMapper.toDTO(bill);
    expect(dto.paidAt).toBe(PAID_AT.toISOString());
  });
});

describe('BillMapper.toListDTO', () => {
  it('should include pagination fields and map each bill', () => {
    const bill = makeBill();

    const dto = BillMapper.toListDTO([bill], 3, 20, 0);

    expect(dto.bills).toHaveLength(1);
    expect(dto.bills[0].id).toBe(UUID);
    expect(dto.total).toBe(3);
    expect(dto.limit).toBe(20);
    expect(dto.offset).toBe(0);
  });

  it('should compute hasMore true when more bills remain', () => {
    const bill = makeBill();
    const dto = BillMapper.toListDTO([bill], 3, 20, 0);
    expect(dto.hasMore).toBe(true);
  });

  it('should compute hasMore false when the page reaches the total', () => {
    const bill = makeBill();
    const dto = BillMapper.toListDTO([bill], 1, 20, 0);
    expect(dto.hasMore).toBe(false);
  });

  it('should default limit to 20 and offset to 0 when omitted', () => {
    const dto = BillMapper.toListDTO([], 0);
    expect(dto.limit).toBe(20);
    expect(dto.offset).toBe(0);
  });
});
