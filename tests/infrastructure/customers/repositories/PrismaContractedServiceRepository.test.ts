// Source: src/infrastructure/customers/repositories/PrismaContractedServiceRepository.ts

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest
} from '@jest/globals';
import { PrismaContractedServiceRepository } from '../../../../src/infrastructure/customers/repositories/PrismaContractedServiceRepository';
import { ContractedService } from '../../../../src/domain/customers';
import {
  ContractedServiceId,
  CustomerId,
  ServicePlanId,
  DeviceId
} from '../../../../src/domain/shared/ids';
import { EventDispatcher } from '../../../../src/domain/shared/core';

// Shaped like a real Prisma error: the code lives on `code`, never in the
// message text.
function makePrismaError(code: string, message: string): Error {
  const error = new Error(message);
  (error as Error & { code: string }).code = code;
  return error;
}

const CS_UUID = '550e8400-e29b-41d4-a716-446655440000';
const CUSTOMER_UUID = '550e8400-e29b-41d4-a716-446655440001';
const PLAN_UUID = '550e8400-e29b-41d4-a716-446655440002';
const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440003';
const NOW = new Date('2024-01-01T00:00:00.000Z');

function makeRaw(overrides: Record<string, unknown> = {}) {
  return {
    id: CS_UUID,
    customerId: CUSTOMER_UUID,
    servicePlanId: PLAN_UUID,
    deviceId: DEVICE_UUID,
    status: 'ACTIVE',
    startDate: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

function makePrisma() {
  return {
    contractedService: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    }
  };
}

function makeService(): ContractedService {
  return ContractedService.reconstitute(
    ContractedServiceId.parse(CS_UUID).value,
    {
      customerId: CustomerId.parse(CUSTOMER_UUID).value,
      servicePlanId: ServicePlanId.parse(PLAN_UUID).value,
      deviceId: DeviceId.parse(DEVICE_UUID).value,
      status: 'ACTIVE' as any,
      startDate: NOW,
      createdAt: NOW,
      updatedAt: NOW
    }
  );
}

describe('PrismaContractedServiceRepository', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let repository: PrismaContractedServiceRepository;
  let dispatchSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    prisma = makePrisma();
    repository = new PrismaContractedServiceRepository(prisma as any);
    dispatchSpy = jest
      .spyOn(EventDispatcher, 'dispatchEventsForAggregate')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    dispatchSpy.mockRestore();
  });

  describe('save()', () => {
    it('should upsert and dispatch events', async () => {
      (prisma.contractedService.upsert as any).mockResolvedValue(
        makeRaw()
      );

      const result = await repository.save(makeService());

      expect(result.isSuccess).toBe(true);
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
    });

    it('should map P2002 to a device-already-assigned failure', async () => {
      (prisma.contractedService.upsert as any).mockRejectedValue(
        makePrismaError('P2002', 'Unique constraint failed')
      );

      const result = await repository.save(makeService());

      expect(result.error).toContain('already assigned');
    });

    it('should map P2003 to a missing-reference failure', async () => {
      (prisma.contractedService.upsert as any).mockRejectedValue(
        makePrismaError('P2003', 'Foreign key constraint failed')
      );

      const result = await repository.save(makeService());

      expect(result.error).toContain('does not exist');
    });
  });

  describe('findByDeviceId()', () => {
    it('should query by the deviceId unique key', async () => {
      (prisma.contractedService.findUnique as any).mockResolvedValue(
        makeRaw()
      );

      await repository.findByDeviceId(
        DeviceId.parse(DEVICE_UUID).value
      );

      expect(
        prisma.contractedService.findUnique
      ).toHaveBeenCalledWith({ where: { deviceId: DEVICE_UUID } });
    });

    it('should return null when no service owns the device', async () => {
      (prisma.contractedService.findUnique as any).mockResolvedValue(
        null
      );

      const result = await repository.findByDeviceId(
        DeviceId.parse(DEVICE_UUID).value
      );

      expect(result.value).toBeNull();
    });
  });

  describe('findByCustomerId()', () => {
    it('should map all rows for the customer', async () => {
      (prisma.contractedService.findMany as any).mockResolvedValue([
        makeRaw(),
        makeRaw({ id: '550e8400-e29b-41d4-a716-446655440009' })
      ]);

      const result = await repository.findByCustomerId(
        CustomerId.parse(CUSTOMER_UUID).value
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(2);
    });
  });
});
