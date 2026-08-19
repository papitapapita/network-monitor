// Source: src/infrastructure/customers/mappers/ServicePlanPrismaMapper.ts

import { describe, it, expect } from '@jest/globals';
import { ServicePlanPrismaMapper } from '../../../../src/infrastructure/customers/mappers/ServicePlanPrismaMapper';
import { ServicePlan } from '../../../../src/domain/customers';
import { ServicePlanId } from '../../../../src/domain/shared/ids';

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

describe('ServicePlanPrismaMapper', () => {
  describe('toDomain()', () => {
    it('should map a record to a ServicePlan', () => {
      const result = ServicePlanPrismaMapper.toDomain(makeRaw());
      expect(result.isSuccess).toBe(true);
      expect(result.value.name).toBe('Plan 50/10');
      expect(result.value.monthlyPrice).toBe(80000);
    });

    it('should normalize a Prisma Decimal price to a number', () => {
      // Prisma Decimal stringifies to its numeric value; Number() relies on that.
      const decimal = {
        toNumber: () => 80000,
        toString: () => '80000'
      };
      const result = ServicePlanPrismaMapper.toDomain(
        makeRaw({ monthlyPrice: decimal })
      );
      expect(result.value.monthlyPrice).toBe(80000);
    });

    it('should fail for an invalid id', () => {
      const result = ServicePlanPrismaMapper.toDomain(
        makeRaw({ id: 'bad' })
      );
      expect(result.isFailure).toBe(true);
    });
  });

  describe('toPersistence()', () => {
    it('should round-trip through toDomain', () => {
      const plan = ServicePlanPrismaMapper.toDomain(makeRaw()).value;
      const data = ServicePlanPrismaMapper.toPersistence(plan);
      expect(data).toEqual(makeRaw());
    });

    it('should output id from the aggregate', () => {
      const plan = ServicePlan.reconstitute(
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
      const data = ServicePlanPrismaMapper.toPersistence(plan);
      expect(data.id).toBe(VALID_UUID);
    });
  });
});
