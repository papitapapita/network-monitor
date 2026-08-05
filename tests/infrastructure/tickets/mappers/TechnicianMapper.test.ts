// Source: src/infrastructure/tickets/mappers/TechnicianMapper.ts

import { describe, it, expect } from '@jest/globals';
import { TechnicianMapper } from '../../../../src/infrastructure/tickets/mappers';
import {
  Technician,
  ContactPhone
} from '../../../../src/domain/tickets';
import { UserId } from '../../../../src/domain/shared/ids';

const TECH_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NOW = new Date('2026-08-04T12:00:00.000Z');

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TECH_UUID,
    fullName: 'Andrés Muñoz',
    phone: '+573001112233',
    email: null,
    userId: null,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  } as Parameters<typeof TechnicianMapper.toDomain>[0];
}

function makeTechnician(overrides: Record<string, unknown> = {}) {
  const result = Technician.create({
    fullName: 'Andrés Muñoz',
    phone: ContactPhone.reconstitute('+573001112233'),
    email: null,
    userId: null,
    ...overrides
  } as Parameters<typeof Technician.create>[0]);
  if (result.isFailure) throw new Error(result.error);
  return result.value;
}

describe('TechnicianMapper (infrastructure)', () => {
  describe('toDomain()', () => {
    it('reconstitutes a technician from a row', () => {
      const result = TechnicianMapper.toDomain(makeRow());

      expect(result.isSuccess).toBe(true);
      expect(result.value.id.toString()).toBe(TECH_UUID);
      expect(result.value.fullName).toBe('Andrés Muñoz');
      expect(result.value.phone.value).toBe('+573001112233');
      expect(result.value.isActive).toBe(true);
    });

    it('reconstitutes the user link when present', () => {
      const userId = UserId.create().toString();

      const result = TechnicianMapper.toDomain(makeRow({ userId }));

      expect(result.value.userId!.toString()).toBe(userId);
    });

    it('bypasses validation so a legacy row still loads', () => {
      const result = TechnicianMapper.toDomain(
        makeRow({ fullName: '' })
      );

      expect(result.isSuccess).toBe(true);
    });

    it('fails on a malformed technician id', () => {
      const result = TechnicianMapper.toDomain(
        makeRow({ id: 'nope' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid technician ID');
    });

    it('fails on a malformed user id', () => {
      const result = TechnicianMapper.toDomain(
        makeRow({ userId: 'nope' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid technician user ID');
    });
  });

  describe('toPersistence()', () => {
    it('flattens the phone value object to a string', () => {
      const data = TechnicianMapper.toPersistence(makeTechnician());

      expect(data.phone).toBe('+573001112233');
    });

    it('nulls an absent user link', () => {
      const data = TechnicianMapper.toPersistence(makeTechnician());

      expect(data.userId).toBeNull();
    });

    it('flattens a present user link to a string', () => {
      const userId = UserId.create();

      const data = TechnicianMapper.toPersistence(
        makeTechnician({ userId })
      );

      expect(data.userId).toBe(userId.toString());
    });

    it('round-trips through toDomain', () => {
      const original = makeTechnician({
        email: 'andres@isp.example'
      });

      const restored = TechnicianMapper.toDomain(
        TechnicianMapper.toPersistence(original) as never
      );

      expect(restored.isSuccess).toBe(true);
      expect(restored.value.fullName).toBe(original.fullName);
      expect(restored.value.phone.value).toBe(original.phone.value);
      expect(restored.value.email).toBe('andres@isp.example');
    });
  });
});
