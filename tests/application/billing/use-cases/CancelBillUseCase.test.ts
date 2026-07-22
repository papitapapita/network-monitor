// Source: src/application/billing/use-cases/CancelBillUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { CancelBillUseCase } from '../../../../src/application/billing/use-cases/CancelBillUseCase';
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
    existsForCustomerAndPeriod: jest.fn(),
    exists: jest.fn()
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

describe('CancelBillUseCase', () => {
  let billRepo: jest.Mocked<IBillRepository>;
  let useCase: CancelBillUseCase;

  beforeEach(() => {
    billRepo = makeBillRepo();
    useCase = new CancelBillUseCase(billRepo, makeLogger());
    (billRepo.save as any).mockImplementation(async (b: unknown) =>
      Result.ok(b)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fail when the bill does not exist', async () => {
    (billRepo.findById as any).mockResolvedValue(Result.ok(null));

    const result = await useCase.execute({ id: VALID_UUID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Bill not found');
    expect(billRepo.save).not.toHaveBeenCalled();
  });

  it('should propagate a domain rejection when the bill is already PAID', async () => {
    (billRepo.findById as any).mockResolvedValue(
      Result.ok(makeBill(BillStatus.PAID))
    );

    const result = await useCase.execute({ id: VALID_UUID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Cannot cancel a paid bill');
    expect(billRepo.save).not.toHaveBeenCalled();
  });

  it('should propagate a domain rejection when the bill is already CANCELLED', async () => {
    (billRepo.findById as any).mockResolvedValue(
      Result.ok(makeBill(BillStatus.CANCELLED))
    );

    const result = await useCase.execute({ id: VALID_UUID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(
      'Cannot cancel an already cancelled bill'
    );
    expect(billRepo.save).not.toHaveBeenCalled();
  });

  it('should cancel a PENDING bill, save it, and return the updated DTO', async () => {
    (billRepo.findById as any).mockResolvedValue(
      Result.ok(makeBill(BillStatus.PENDING))
    );

    const result = await useCase.execute({ id: VALID_UUID });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('CANCELLED');
    expect(billRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should cancel an OVERDUE bill, save it, and return the updated DTO', async () => {
    (billRepo.findById as any).mockResolvedValue(
      Result.ok(makeBill(BillStatus.OVERDUE))
    );

    const result = await useCase.execute({ id: VALID_UUID });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('CANCELLED');
    expect(billRepo.save).toHaveBeenCalledTimes(1);
  });
});
