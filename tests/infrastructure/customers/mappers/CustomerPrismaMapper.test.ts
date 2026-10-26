// Source: src/infrastructure/customers/mappers/CustomerPrismaMapper.ts

import { describe, it, expect } from '@jest/globals';
import { CustomerPrismaMapper } from '../../../../src/infrastructure/customers/mappers/CustomerPrismaMapper';
import {
  Customer,
  PhoneNumber,
  Cedula,
  EmailAddress
} from '../../../../src/domain/customers';
import { CustomerId } from '../../../../src/domain/shared/ids';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NOW = new Date('2024-01-01T00:00:00.000Z');

function makeRaw(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    fullName: 'Juan Perez',
    phone: '3001234567',
    email: 'juan@example.com',
    cedula: '1036612',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

function makeCustomer() {
  return Customer.reconstitute(CustomerId.parse(VALID_UUID).value, {
    fullName: 'Juan Perez',
    phone: PhoneNumber.reconstitute('3001234567'),
    email: EmailAddress.reconstitute('juan@example.com'),
    cedula: Cedula.reconstitute('1036612'),
    createdAt: NOW,
    updatedAt: NOW
  });
}

describe('CustomerPrismaMapper', () => {
  describe('toDomain()', () => {
    it('should map a full record to a Customer', () => {
      const result = CustomerPrismaMapper.toDomain(makeRaw());
      expect(result.isSuccess).toBe(true);
      expect(result.value.fullName).toBe('Juan Perez');
      expect(result.value.phone.value).toBe('3001234567');
      expect(result.value.email?.value).toBe('juan@example.com');
      expect(result.value.cedula?.value).toBe('1036612');
    });

    it('should map null email and cedula', () => {
      const result = CustomerPrismaMapper.toDomain(
        makeRaw({ email: null, cedula: null })
      );
      expect(result.value.email).toBeNull();
      expect(result.value.cedula).toBeNull();
    });

    it('should fail for an invalid id', () => {
      const result = CustomerPrismaMapper.toDomain(
        makeRaw({ id: 'not-a-uuid' })
      );
      expect(result.isFailure).toBe(true);
    });
  });

  describe('toPersistence()', () => {
    it('should produce a flat record', () => {
      const data = CustomerPrismaMapper.toPersistence(makeCustomer());
      expect(data).toEqual({
        id: VALID_UUID,
        fullName: 'Juan Perez',
        phone: '3001234567',
        email: 'juan@example.com',
        cedula: '1036612',
        createdAt: NOW,
        updatedAt: NOW
      });
    });
  });

  describe('round-trip', () => {
    it('should preserve values through toDomain -> toPersistence', () => {
      const customer = CustomerPrismaMapper.toDomain(makeRaw()).value;
      const data = CustomerPrismaMapper.toPersistence(customer);
      expect(data).toEqual(makeRaw());
    });
  });
});
