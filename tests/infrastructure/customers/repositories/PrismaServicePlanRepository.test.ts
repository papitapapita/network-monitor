// Source: src/infrastructure/customers/repositories/PrismaServicePlanRepository.ts

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest
} from '@jest/globals';
import { PrismaServicePlanRepository } from '../../../../src/infrastructure/customers/repositories/PrismaServicePlanRepository';
import { ServicePlan } from '../../../../src/domain/customers';
import { ServicePlanId } from '../../../../src/domain/shared/ids';
import { EventDispatcher } from '../../../../src/domain/shared/core';

// Shaped like a real Prisma error: the code lives on `code`, never in the
// message text.
function makePrismaError(code: string, message: string): Error {
  const error = new Error(message);
  (error as Error & { code: string }).code = code;
  return error;
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NOW = new Date('2024-01-01T00:00:00.000Z');

function makeRaw(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    name: 'Plan 50/10',
    downloadMbps: 50,
    uploadMbps: 10,
    monthlyPrice: 80000,
    description: null,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

function makePrisma() {
  return {
    servicePlan: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    }
  };
}

function makePlan(): ServicePlan {
  return ServicePlan.reconstitute(
    ServicePlanId.parse(VALID_UUID).value,
    {
      name: 'Plan 50/10',
      downloadMbps: 50,
      uploadMbps: 10,
      monthlyPrice: 80000,
      description: null,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW
    }
  );
}

describe('PrismaServicePlanRepository', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let repository: PrismaServicePlanRepository;
  let dispatchSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    prisma = makePrisma();
    repository = new PrismaServicePlanRepository(prisma as any);
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
      (prisma.servicePlan.upsert as any).mockResolvedValue(makeRaw());

      const result = await repository.save(makePlan());

      expect(result.isSuccess).toBe(true);
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
    });

    it('should return "already exists" on P2002', async () => {
      (prisma.servicePlan.upsert as any).mockRejectedValue(
        makePrismaError('P2002', 'Unique constraint failed')
      );

      const result = await repository.save(makePlan());

      expect(result.error).toContain('already exists');
    });
  });

  describe('findById()', () => {
    it('should map a Decimal price found in the row', async () => {
      (prisma.servicePlan.findUnique as any).mockResolvedValue(
        makeRaw({
          monthlyPrice: {
            toNumber: () => 80000,
            toString: () => '80000'
          }
        })
      );

      const result = await repository.findById(
        ServicePlanId.parse(VALID_UUID).value
      );

      expect(result.value!.monthlyPrice).toBe(80000);
    });
  });

  describe('delete()', () => {
    it('should map P2003 to a referenced-by failure', async () => {
      (prisma.servicePlan.delete as any).mockRejectedValue(
        makePrismaError('P2003', 'Foreign key constraint failed')
      );

      const result = await repository.delete(
        ServicePlanId.parse(VALID_UUID).value
      );

      expect(result.error).toContain('contracted services');
    });
  });
});
