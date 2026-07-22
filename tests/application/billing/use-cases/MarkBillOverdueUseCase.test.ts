// Source: src/application/billing/use-cases/MarkBillOverdueUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { MarkBillOverdueUseCase } from '../../../../src/application/billing/use-cases/MarkBillOverdueUseCase';
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
const ISSUE_DATE = new Date('2020-01-01T00:00:00.000Z');
// Safely in the past relative to any real test run.
const PAST_DUE_DATE = new Date('2020-01-16T00:00:00.000Z');
// Safely in the future relative to any real test run.
const FUTURE_DUE_DATE = new Date('2999-01-01T00:00:00.000Z');

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

function makeBill(
  status: BillStatus,
  dueDate: Date = PAST_DUE_DATE
): Bill {
  return Bill.reconstitute(BillId.parse(VALID_UUID).value, {
    customerId: CustomerId.create(),
    period: BillingPeriod.create(2020, 1).value,
    status,
    lineItems: [
      BillLineItem.create({
        contractedServiceId: ContractedServiceId.create(),
        servicePlanId: ServicePlanId.create(),
        planName: 'Fiber 50/10',
        monthlyPrice: Money.create(19.99).value
      }).value
    ],
    issueDate: ISSUE_DATE,
    dueDate,
    paidAt: status === BillStatus.PAID ? ISSUE_DATE : null,
    createdAt: ISSUE_DATE,
    updatedAt: ISSUE_DATE
  });
}

describe('MarkBillOverdueUseCase', () => {
  let billRepo: jest.Mocked<IBillRepository>;
  let useCase: MarkBillOverdueUseCase;

  beforeEach(() => {
    billRepo = makeBillRepo();
    useCase = new MarkBillOverdueUseCase(billRepo, makeLogger());
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
    expect(result.error).toContain(
      'Cannot mark a PAID bill as overdue'
    );
    expect(billRepo.save).not.toHaveBeenCalled();
  });

  it('should propagate a domain rejection when the bill is not yet past its due date', async () => {
    (billRepo.findById as any).mockResolvedValue(
      Result.ok(makeBill(BillStatus.PENDING, FUTURE_DUE_DATE))
    );

    const result = await useCase.execute({ id: VALID_UUID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('not past its due date');
    expect(billRepo.save).not.toHaveBeenCalled();
  });

  it('should mark a past-due PENDING bill overdue, save it, and return the updated DTO', async () => {
    (billRepo.findById as any).mockResolvedValue(
      Result.ok(makeBill(BillStatus.PENDING, PAST_DUE_DATE))
    );

    const result = await useCase.execute({ id: VALID_UUID });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('OVERDUE');
    expect(billRepo.save).toHaveBeenCalledTimes(1);
  });
});
