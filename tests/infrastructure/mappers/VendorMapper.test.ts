// Source: src/infrastructure/mappers/VendorMapper.ts

import { describe, it, expect, afterEach } from '@jest/globals';
import { VendorMapper } from '../../../src/infrastructure/mappers/VendorMapper';
import { Vendor } from '../../../src/domain/device-inventory/aggregates/Vendor';
import { VendorId } from '../../../src/domain/shared/ids/VendorId';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NOW = new Date('2024-01-01T00:00:00.000Z');
const UPDATED = new Date('2024-06-01T00:00:00.000Z');

type PrismaVendorRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function makeRaw(
  overrides: Partial<PrismaVendorRecord> = {}
): PrismaVendorRecord {
  return {
    id: VALID_UUID,
    name: 'Mikrotik',
    slug: 'mikrotik',
    description: 'Network equipment manufacturer',
    createdAt: NOW,
    updatedAt: UPDATED,
    ...overrides
  };
}

function makeVendor(
  overrides: Partial<{
    name: string;
    slug: string;
    description: string | null;
  }> = {}
): Vendor {
  const id = VendorId.parse(VALID_UUID).value!;
  return Vendor.reconstitute(id, {
    name: overrides.name ?? 'Mikrotik',
    slug: overrides.slug ?? 'mikrotik',
    description:
      overrides.description !== undefined
        ? overrides.description
        : 'Network equipment manufacturer',
    createdAt: NOW,
    updatedAt: UPDATED
  });
}

// ---------------------------------------------------------------------------

describe('VendorMapper', () => {
  afterEach(() => {
    // No jest mocks used directly but kept for consistency
  });

  // =========================================================================
  describe('toDomain()', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should return a Result with isSuccess=true for a valid raw record', () => {
        const raw = makeRaw();

        const result = VendorMapper.toDomain(raw);

        expect(result.isSuccess).toBe(true);
      });

      it('should map the id to a VendorId whose string value equals the raw id', () => {
        const raw = makeRaw();

        const result = VendorMapper.toDomain(raw);

        expect(result.value!.id.toString()).toBe(VALID_UUID);
      });

      it('should map name correctly', () => {
        const raw = makeRaw({ name: 'Ubiquiti' });

        const result = VendorMapper.toDomain(raw);

        expect(result.value!.name).toBe('Ubiquiti');
      });

      it('should map slug correctly', () => {
        const raw = makeRaw({ slug: 'ubiquiti' });

        const result = VendorMapper.toDomain(raw);

        expect(result.value!.slug).toBe('ubiquiti');
      });

      it('should map description when it is a non-null string', () => {
        const raw = makeRaw({
          description: 'Enterprise networking gear'
        });

        const result = VendorMapper.toDomain(raw);

        expect(result.value!.description).toBe(
          'Enterprise networking gear'
        );
      });

      it('should map description as null when raw description is null', () => {
        const raw = makeRaw({ description: null });

        const result = VendorMapper.toDomain(raw);

        expect(result.value!.description).toBeNull();
      });

      it('should map createdAt as the same Date instance', () => {
        const raw = makeRaw();

        const result = VendorMapper.toDomain(raw);

        expect(result.value!.createdAt).toEqual(NOW);
      });

      it('should map updatedAt as the same Date instance', () => {
        const raw = makeRaw();

        const result = VendorMapper.toDomain(raw);

        expect(result.value!.updatedAt).toEqual(UPDATED);
      });

      it('should return a Vendor with no domain events (reconstitution path)', () => {
        const raw = makeRaw();

        const result = VendorMapper.toDomain(raw);

        expect(result.value!.domainEvents.length).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('failure — invalid id', () => {
      it('should return a Result with isFailure=true when id is not a valid UUID', () => {
        const raw = makeRaw({ id: 'not-a-uuid' });

        const result = VendorMapper.toDomain(raw);

        expect(result.isFailure).toBe(true);
      });

      it('should include "Invalid vendor ID" in the error message', () => {
        const raw = makeRaw({ id: 'bad-id' });

        const result = VendorMapper.toDomain(raw);

        expect(result.error).toContain('Invalid vendor ID');
      });

      it('should return isFailure=true when id is an empty string', () => {
        const raw = makeRaw({ id: '' });

        const result = VendorMapper.toDomain(raw);

        expect(result.isFailure).toBe(true);
      });
    });
  });

  // =========================================================================
  describe('toPersistence()', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should serialize id as a string matching the original UUID', () => {
        const vendor = makeVendor();

        const data = VendorMapper.toPersistence(vendor);

        expect(data.id).toBe(VALID_UUID);
      });

      it('should serialize name correctly', () => {
        const vendor = makeVendor({ name: 'Cisco' });

        const data = VendorMapper.toPersistence(vendor);

        expect(data.name).toBe('Cisco');
      });

      it('should serialize slug correctly', () => {
        const vendor = makeVendor({ slug: 'cisco' });

        const data = VendorMapper.toPersistence(vendor);

        expect(data.slug).toBe('cisco');
      });

      it('should serialize description when it is a non-null string', () => {
        const vendor = makeVendor({
          description: 'Enterprise solutions'
        });

        const data = VendorMapper.toPersistence(vendor);

        expect(data.description).toBe('Enterprise solutions');
      });

      it('should preserve null description as null', () => {
        const vendor = makeVendor({ description: null });

        const data = VendorMapper.toPersistence(vendor);

        expect(data.description).toBeNull();
      });

      it('should pass createdAt through as a Date object', () => {
        const vendor = makeVendor();

        const data = VendorMapper.toPersistence(vendor);

        expect(data.createdAt).toBeInstanceOf(Date);
        expect(data.createdAt).toEqual(NOW);
      });

      it('should pass updatedAt through as a Date object', () => {
        const vendor = makeVendor();

        const data = VendorMapper.toPersistence(vendor);

        expect(data.updatedAt).toBeInstanceOf(Date);
        expect(data.updatedAt).toEqual(UPDATED);
      });

      it('should include all six expected fields in the persistence shape', () => {
        const vendor = makeVendor();

        const data = VendorMapper.toPersistence(vendor);

        expect(Object.keys(data).sort()).toEqual(
          [
            'createdAt',
            'description',
            'id',
            'name',
            'slug',
            'updatedAt'
          ].sort()
        );
      });
    });
  });

  // =========================================================================
  describe('round-trip — toDomain → toPersistence', () => {
    it('should reproduce the same id, name, slug, and description after a round-trip', () => {
      const raw = makeRaw({ description: 'Networking leader' });

      const domainResult = VendorMapper.toDomain(raw);
      expect(domainResult.isSuccess).toBe(true);

      const serialized = VendorMapper.toPersistence(
        domainResult.value!
      );

      expect(serialized.id).toBe(raw.id);
      expect(serialized.name).toBe(raw.name);
      expect(serialized.slug).toBe(raw.slug);
      expect(serialized.description).toBe(raw.description);
    });

    it('should preserve null description after a round-trip', () => {
      const raw = makeRaw({ description: null });

      const domainResult = VendorMapper.toDomain(raw);
      const serialized = VendorMapper.toPersistence(
        domainResult.value!
      );

      expect(serialized.description).toBeNull();
    });

    it('should preserve date values after a round-trip', () => {
      const raw = makeRaw();

      const domainResult = VendorMapper.toDomain(raw);
      const serialized = VendorMapper.toPersistence(
        domainResult.value!
      );

      expect(serialized.createdAt).toEqual(NOW);
      expect(serialized.updatedAt).toEqual(UPDATED);
    });
  });
});
