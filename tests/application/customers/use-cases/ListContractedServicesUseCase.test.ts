// Source: src/application/customers/use-cases/ListContractedServicesUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach
} from '@jest/globals';
import { ListContractedServicesUseCase } from '../../../../src/application/customers/use-cases/ListContractedServicesUseCase';
import { IContractedServiceDetailQuery } from '../../../../src/application/customers/interfaces';
import { ContractedServiceDetailDTO } from '../../../../src/application/customers/dtos';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const CS_UUID = '550e8400-e29b-41d4-a716-446655440000';
const CUSTOMER_UUID = '550e8400-e29b-41d4-a716-446655440001';
const PLAN_UUID = '550e8400-e29b-41d4-a716-446655440002';
const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440003';

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

function makeQuery(): jest.Mocked<IContractedServiceDetailQuery> {
  return {
    findById: jest.fn(),
    list: jest.fn(),
    count: jest.fn()
  };
}

function makeDetail(
  overrides: Partial<ContractedServiceDetailDTO> = {}
): ContractedServiceDetailDTO {
  return {
    id: CS_UUID,
    customerId: CUSTOMER_UUID,
    servicePlanId: PLAN_UUID,
    deviceId: DEVICE_UUID,
    status: 'ACTIVE',
    startDate: '2026-01-01T00:00:00.000Z',
    paymentDay: 30,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    customer: {
      id: CUSTOMER_UUID,
      fullName: 'Ana Gómez',
      phone: '3001234567',
      email: null,
      cedula: null
    },
    servicePlan: {
      id: PLAN_UUID,
      name: 'Plan 50/10',
      downloadMbps: 50,
      uploadMbps: 10,
      monthlyPrice: 80000,
      isActive: true
    },
    device: null,
    ...overrides
  };
}

describe('ListContractedServicesUseCase', () => {
  let query: jest.Mocked<IContractedServiceDetailQuery>;
  let useCase: ListContractedServicesUseCase;

  beforeEach(() => {
    query = makeQuery();
    useCase = new ListContractedServicesUseCase(query, makeLogger());
  });

  describe('[CUS-123] filtering by device', () => {
    it('passes the device id to the query and returns the set unpaged', async () => {
      query.list.mockResolvedValue(Result.ok([makeDetail()]));

      const result = await useCase.execute({
        deviceId: DEVICE_UUID,
        limit: 5,
        offset: 10
      });

      expect(result.isSuccess).toBe(true);
      const criteria = query.list.mock.calls[0][0];
      expect(criteria.deviceId?.toString()).toBe(DEVICE_UUID);
      expect(criteria.limit).toBeUndefined();
      expect(criteria.offset).toBeUndefined();
      expect(result.value).toMatchObject({
        total: 1,
        hasMore: false,
        limit: 1,
        offset: 0
      });
      expect(query.count).not.toHaveBeenCalled();
    });

    it('returns an empty list when the device has no service', async () => {
      query.list.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
      expect(result.value.contractedServices).toEqual([]);
      expect(result.value.total).toBe(0);
    });

    it('combines with customerId', async () => {
      query.list.mockResolvedValue(Result.ok([]));

      await useCase.execute({
        customerId: CUSTOMER_UUID,
        deviceId: DEVICE_UUID
      });

      const criteria = query.list.mock.calls[0][0];
      expect(criteria.customerId?.toString()).toBe(CUSTOMER_UUID);
      expect(criteria.deviceId?.toString()).toBe(DEVICE_UUID);
    });

    it('fails on a malformed device id without querying', async () => {
      const result = await useCase.execute({
        deviceId: 'not-a-uuid'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid deviceId');
      expect(query.list).not.toHaveBeenCalled();
    });
  });

  describe('[CUS-122] filtering by customer', () => {
    it('returns the full set unpaged', async () => {
      query.list.mockResolvedValue(
        Result.ok([makeDetail(), makeDetail()])
      );

      const result = await useCase.execute({
        customerId: CUSTOMER_UUID,
        limit: 1
      });

      expect(result.value.contractedServices).toHaveLength(2);
      expect(result.value.hasMore).toBe(false);
    });

    it('fails on a malformed customer id', async () => {
      const result = await useCase.execute({ customerId: 'nope' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid customerId');
    });
  });

  describe('[CUS-120] unfiltered', () => {
    it('pages with the default limit and reports the total', async () => {
      query.list.mockResolvedValue(Result.ok([makeDetail()]));
      query.count.mockResolvedValue(Result.ok(45));

      const result = await useCase.execute({});

      expect(query.list).toHaveBeenCalledWith({
        limit: 20,
        offset: 0
      });
      expect(result.value).toMatchObject({
        total: 45,
        hasMore: true,
        limit: 20,
        offset: 0
      });
    });

    it('clamps the limit to 100', async () => {
      query.list.mockResolvedValue(Result.ok([]));
      query.count.mockResolvedValue(Result.ok(0));

      await useCase.execute({ limit: 500 });

      expect(query.list).toHaveBeenCalledWith({
        limit: 100,
        offset: 0
      });
    });

    it('propagates a query failure', async () => {
      query.list.mockResolvedValue(Result.fail('Database error'));

      const result = await useCase.execute({});

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Database error');
    });
  });
});
