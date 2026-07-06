// Source: src/infrastructure/customers/mappers/ContractedServicePrismaMapper.ts

import { describe, it, expect } from '@jest/globals';
import { ContractedServicePrismaMapper } from '../../../../src/infrastructure/customers/mappers/ContractedServicePrismaMapper';
import { ContractedServiceStatus } from '../../../../src/domain/customers';

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

describe('ContractedServicePrismaMapper', () => {
  describe('toDomain()', () => {
    it('should map a full record', () => {
      const result = ContractedServicePrismaMapper.toDomain(makeRaw());
      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe(
        ContractedServiceStatus.ACTIVE
      );
      expect(result.value.deviceId?.toString()).toBe(DEVICE_UUID);
    });

    it('should map a null deviceId', () => {
      const result = ContractedServicePrismaMapper.toDomain(
        makeRaw({ deviceId: null, status: 'PENDING' })
      );
      expect(result.value.deviceId).toBeNull();
    });

    it('should fail for an unrecognised status', () => {
      // mapStatusFromPrisma throws; the mapper does not catch, so expect throw
      expect(() =>
        ContractedServicePrismaMapper.toDomain(
          makeRaw({ status: 'WAT' })
        )
      ).toThrow('unrecognised ContractedServiceStatus');
    });

    it('should fail for an invalid customer id', () => {
      const result = ContractedServicePrismaMapper.toDomain(
        makeRaw({ customerId: 'bad' })
      );
      expect(result.isFailure).toBe(true);
    });
  });

  describe('toPersistence()', () => {
    it('should round-trip through toDomain', () => {
      const service = ContractedServicePrismaMapper.toDomain(
        makeRaw()
      ).value;
      const data =
        ContractedServicePrismaMapper.toPersistence(service);
      expect(data).toEqual(makeRaw());
    });

    it('should serialize a null deviceId', () => {
      const service = ContractedServicePrismaMapper.toDomain(
        makeRaw({ deviceId: null, status: 'PENDING' })
      ).value;
      const data =
        ContractedServicePrismaMapper.toPersistence(service);
      expect(data.deviceId).toBeNull();
    });
  });
});
