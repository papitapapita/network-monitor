// Source: src/application/billing/use-cases/MarkBillPaidUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { MarkBillPaidUseCase } from '../../../../src/application/billing/use-cases/MarkBillPaidUseCase';
import { IBillRepository } from '../../../../src/domain/billing/repository';
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
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NOW = new Date('2024-03-01T00:00:00.000Z');
const DUE_DATE = new Date('2024-03-16T00:00:00.000Z');
const USER_UUID = '6a1f3c2e-8b4d-4e7f-9a0b-1c2d3e4f5a6b';
const CASH = { id: VALID_UUID, method: 'CASH' };

function makeLogger(): jest.Mocked<ILogger> {
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

function makeBillRepo(): jest.Mocked<IBillRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByCustomerId: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
    existsForServiceAndPeriod: jest.fn(),
    exists: jest.fn(),
    findPendingDueBefore: jest.fn(),
    findOverdueDueBetween: jest.fn(),
    findServicesOverdueBefore: jest.fn()
  };
}

function makeBill(status: BillStatus): Bill {
  return Bill.reconstitute(BillId.parse(VALID_UUID).value, {
    customerId: CustomerId.create(),
    period: BillingPeriod.create(2024, 3).value,
    status,
    lineItems: [
      BillLineItem.create({
        contractedServiceId: ContractedServiceId.create(),
        servicePlanId: ServicePlanId.create(),
        planName: 'Fiber 50/10',
        monthlyPrice: Money.create(19.99).value
      }).value
    ],
    issueDate: NOW,
    dueDate: DUE_DATE,
    paidAt: status === BillStatus.PAID ? NOW : null,
    createdAt: NOW,
    updatedAt: NOW
  });
}

describe('MarkBillPaidUseCase', () => {
  let billRepo: jest.Mocked<IBillRepository>;
  let useCase: MarkBillPaidUseCase;

  beforeEach(() => {
    billRepo = makeBillRepo();
    useCase = new MarkBillPaidUseCase(billRepo, makeLogger());
    (billRepo.save as any).mockImplementation(async (b: unknown) =>
      Result.ok(b)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fail when the bill does not exist', async () => {
    (billRepo.findById as any).mockResolvedValue(Result.ok(null));

    const result = await useCase.execute(CASH);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Bill not found');
    expect(billRepo.save).not.toHaveBeenCalled();
  });

  it('should propagate a domain rejection when the bill is already PAID', async () => {
    (billRepo.findById as any).mockResolvedValue(
      Result.ok(makeBill(BillStatus.PAID))
    );

    const result = await useCase.execute(CASH);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Cannot mark a PAID bill as paid');
    expect(billRepo.save).not.toHaveBeenCalled();
  });

  it('should propagate a domain rejection when the bill is CANCELLED', async () => {
    (billRepo.findById as any).mockResolvedValue(
      Result.ok(makeBill(BillStatus.CANCELLED))
    );

    const result = await useCase.execute(CASH);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(
      'Cannot mark a CANCELLED bill as paid'
    );
    expect(billRepo.save).not.toHaveBeenCalled();
  });

  it('should mark a PENDING bill paid, save it, and return the updated DTO', async () => {
    (billRepo.findById as any).mockResolvedValue(
      Result.ok(makeBill(BillStatus.PENDING))
    );

    const result = await useCase.execute(CASH);

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('PAID');
    expect(result.value.paidAt).not.toBeNull();
    expect(billRepo.save).toHaveBeenCalledTimes(1);
  });

  describe('the payment record', () => {
    beforeEach(() => {
      (billRepo.findById as any).mockResolvedValue(
        Result.ok(makeBill(BillStatus.PENDING))
      );
    });

    it('[BIL-300] keeps the method, reference, amount, date and who entered it', async () => {
      const result = await useCase.execute({
        id: VALID_UUID,
        method: 'NEQUI',
        reference: '  M123456  ',
        amount: 19.99,
        paidAt: '2024-03-05T15:00:00.000Z',
        recordedByUserId: USER_UUID
      });

      expect(result.value.payment).toEqual({
        method: 'NEQUI',
        reference: 'M123456',
        amount: 19.99,
        paidAt: '2024-03-05T15:00:00.000Z',
        recordedByUserId: USER_UUID
      });
      expect(result.value.paidAt).toBe('2024-03-05T15:00:00.000Z');
    });

    it('[BIL-301] the amount defaults to the bill total', async () => {
      const result = await useCase.execute(CASH);

      expect(result.value.payment).toMatchObject({
        method: 'CASH',
        reference: null,
        amount: 19.99,
        recordedByUserId: null
      });
    });

    it('[BIL-301] refuses part of the total', async () => {
      const result = await useCase.execute({ ...CASH, amount: 10 });

      expect(result.error).toBe(
        "Invalid payment amount: must be the bill's full total of 19.99"
      );
      expect(billRepo.save).not.toHaveBeenCalled();
    });

    it('[BIL-302] refuses a payment date in the future', async () => {
      const result = await useCase.execute({
        ...CASH,
        paidAt: '2999-01-01T00:00:00.000Z'
      });

      expect(result.error).toBe(
        'Invalid payment date: cannot be in the future'
      );
    });

    it('[BIL-300] refuses an unknown method', async () => {
      const result = await useCase.execute({
        id: VALID_UUID,
        method: 'BITCOIN'
      });

      expect(result.error).toContain('Invalid payment method');
      expect(billRepo.save).not.toHaveBeenCalled();
    });

    it('refuses a malformed payment date', async () => {
      const result = await useCase.execute({
        ...CASH,
        paidAt: 'yesterday'
      });

      expect(result.error).toBe(
        'Invalid payment date: not a valid date'
      );
    });

    it('refuses a malformed user id', async () => {
      const result = await useCase.execute({
        ...CASH,
        recordedByUserId: 'nope'
      });

      expect(result.error).toContain('Invalid recordedByUserId');
    });
  });
});
