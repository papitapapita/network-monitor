// Source: src/application/billing/use-cases/ListBillsUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { ListBillsUseCase } from '../../../../src/application/billing/use-cases/ListBillsUseCase';
import { IBillRepository } from '../../../../src/domain/billing/repository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const CUSTOMER_UUID = '550e8400-e29b-41d4-a716-446655440001';

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

describe('ListBillsUseCase', () => {
  let billRepo: jest.Mocked<IBillRepository>;
  let useCase: ListBillsUseCase;

  beforeEach(() => {
    billRepo = makeBillRepo();
    useCase = new ListBillsUseCase(billRepo, makeLogger());

    (billRepo.findAll as any).mockResolvedValue(Result.ok([]));
    (billRepo.count as any).mockResolvedValue(Result.ok(0));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should apply default limit and offset when omitted', async () => {
    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.limit).toBe(20);
    expect(result.value.offset).toBe(0);
    expect(billRepo.findAll).toHaveBeenCalledWith({}, 20, 0);
  });

  it('should pass customerId, status, and period filters through to the repository', async () => {
    const result = await useCase.execute({
      customerId: CUSTOMER_UUID,
      status: 'paid',
      year: 2024,
      month: 3,
      limit: 10,
      offset: 5
    });

    expect(result.isSuccess).toBe(true);
    expect(billRepo.findAll).toHaveBeenCalledTimes(1);
    const [filters, limit, offset] = (billRepo.findAll as any).mock
      .calls[0];
    expect(filters.customerId.toString()).toBe(CUSTOMER_UUID);
    expect(filters.status).toBe('PAID');
    expect(filters.period.toString()).toBe('2024-03');
    expect(limit).toBe(10);
    expect(offset).toBe(5);
    expect(billRepo.count).toHaveBeenCalledWith(filters);
  });

  it('should clamp limit to the maximum of 100', async () => {
    await useCase.execute({ limit: 500 });
    expect(billRepo.findAll).toHaveBeenCalledWith({}, 100, 0);
  });

  it('should fail for an invalid customerId', async () => {
    const result = await useCase.execute({
      customerId: 'not-a-uuid'
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid customerId');
  });

  it('should fail for an invalid status string', async () => {
    const result = await useCase.execute({ status: 'BOGUS_STATUS' });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid status');
  });

  it('should fail when only year is provided without month', async () => {
    const result = await useCase.execute({ year: 2024 });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(
      'Both year and month are required to filter by period'
    );
  });

  it('should fail when only month is provided without year', async () => {
    const result = await useCase.execute({ month: 3 });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(
      'Both year and month are required to filter by period'
    );
  });

  it('should propagate a repository findAll failure', async () => {
    (billRepo.findAll as any).mockResolvedValue(
      Result.fail('DB unavailable')
    );
    const result = await useCase.execute({});
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('DB unavailable');
  });
});
