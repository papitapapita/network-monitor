// Source: src/application/device-inventory/mappers/VendorMapper.ts

import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { VendorMapper } from '../../../../src/application/device-inventory/mappers/VendorMapper';
import { Vendor } from '../../../../src/domain/device-inventory/aggregates/Vendor';
import { VendorId } from '../../../../src/domain/shared/ids/VendorId';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ANOTHER_UUID = '660e8400-e29b-41d4-a716-446655440001';
const CREATED_AT = new Date('2024-01-01T00:00:00.000Z');
const UPDATED_AT = new Date('2024-06-15T12:30:00.000Z');

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeVendor(
  overrides: Partial<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {}
): Vendor {
  return Vendor.reconstitute(
    VendorId.parse(overrides.id ?? VALID_UUID).value!,
    {
      name: overrides.name ?? 'Mikrotik',
      slug: overrides.slug ?? 'mikrotik',
      description: overrides.description !== undefined ? overrides.description : null,
      createdAt: overrides.createdAt ?? CREATED_AT,
      updatedAt: overrides.updatedAt ?? UPDATED_AT
    }
  );
}

// ---------------------------------------------------------------------------

afterEach(() => {
  jest.clearAllMocks();
});

describe('VendorMapper', () => {
  // =========================================================================
  describe('toDTO', () => {
    describe('id mapping', () => {
      it('should map vendor id to a string', () => {
        const dto = VendorMapper.toDTO(makeVendor());

        expect(typeof dto.id).toBe('string');
      });

      it('should map vendor id to the correct UUID string', () => {
        const dto = VendorMapper.toDTO(makeVendor({ id: VALID_UUID }));

        expect(dto.id).toBe(VALID_UUID);
      });
    });

    describe('scalar field mapping', () => {
      it('should map name correctly', () => {
        const dto = VendorMapper.toDTO(makeVendor({ name: 'Ubiquiti' }));

        expect(dto.name).toBe('Ubiquiti');
      });

      it('should map slug correctly', () => {
        const dto = VendorMapper.toDTO(makeVendor({ slug: 'ubiquiti' }));

        expect(dto.slug).toBe('ubiquiti');
      });

      it('should map description when it has a value', () => {
        const dto = VendorMapper.toDTO(makeVendor({ description: 'Networking vendor' }));

        expect(dto.description).toBe('Networking vendor');
      });

      it('should preserve description as null when vendor has no description', () => {
        const dto = VendorMapper.toDTO(makeVendor({ description: null }));

        expect(dto.description).toBeNull();
      });
    });

    describe('date mapping', () => {
      it('should map createdAt as an ISO 8601 string', () => {
        const dto = VendorMapper.toDTO(makeVendor({ createdAt: CREATED_AT }));

        expect(dto.createdAt).toBe(CREATED_AT.toISOString());
      });

      it('should map updatedAt as an ISO 8601 string', () => {
        const dto = VendorMapper.toDTO(makeVendor({ updatedAt: UPDATED_AT }));

        expect(dto.updatedAt).toBe(UPDATED_AT.toISOString());
      });

      it('should produce a valid ISO 8601 date string for createdAt', () => {
        const dto = VendorMapper.toDTO(makeVendor());

        expect(() => new Date(dto.createdAt)).not.toThrow();
        expect(new Date(dto.createdAt).toISOString()).toBe(dto.createdAt);
      });
    });

    describe('DTO shape', () => {
      it('should return an object with exactly the expected keys', () => {
        const dto = VendorMapper.toDTO(makeVendor());
        const keys = Object.keys(dto).sort();

        expect(keys).toEqual(
          ['createdAt', 'description', 'id', 'name', 'slug', 'updatedAt']
        );
      });
    });
  });

  // =========================================================================
  describe('toListDTO', () => {
    describe('pagination metadata', () => {
      it('should include the provided total in the response', () => {
        const result = VendorMapper.toListDTO([makeVendor()], 50, 10, 0);

        expect(result.total).toBe(50);
      });

      it('should include the provided limit in the response', () => {
        const result = VendorMapper.toListDTO([], 0, 10, 0);

        expect(result.limit).toBe(10);
      });

      it('should include the provided offset in the response', () => {
        const result = VendorMapper.toListDTO([], 0, 20, 40);

        expect(result.offset).toBe(40);
      });

      it('should default limit to 20 when omitted', () => {
        const result = VendorMapper.toListDTO([], 0);

        expect(result.limit).toBe(20);
      });

      it('should default offset to 0 when omitted', () => {
        const result = VendorMapper.toListDTO([], 0);

        expect(result.offset).toBe(0);
      });
    });

    describe('hasMore calculation', () => {
      it('should set hasMore to true when more items exist after the current page', () => {
        const result = VendorMapper.toListDTO([makeVendor()], 5, 1, 0);

        expect(result.hasMore).toBe(true);
      });

      it('should set hasMore to false when the current page covers all items', () => {
        const vendors = [makeVendor(), makeVendor()];
        const result = VendorMapper.toListDTO(vendors, 2, 20, 0);

        expect(result.hasMore).toBe(false);
      });

      it('should set hasMore to false when the vendors array is empty', () => {
        const result = VendorMapper.toListDTO([], 0, 20, 0);

        expect(result.hasMore).toBe(false);
      });

      it('should set hasMore to false on the last page with partial results', () => {
        const vendors = [makeVendor()];
        const result = VendorMapper.toListDTO(vendors, 21, 20, 20);

        expect(result.hasMore).toBe(false);
      });
    });

    describe('vendor mapping', () => {
      it('should map each vendor through toDTO', () => {
        const vendors = [
          makeVendor({ id: VALID_UUID, name: 'Mikrotik' }),
          makeVendor({ id: ANOTHER_UUID, name: 'Ubiquiti' })
        ];

        const result = VendorMapper.toListDTO(vendors, 2);

        expect(result.vendors).toHaveLength(2);
      });

      it('should preserve vendor names in the mapped list', () => {
        const vendors = [makeVendor({ name: 'Cisco' })];

        const result = VendorMapper.toListDTO(vendors, 1);

        expect(result.vendors[0].name).toBe('Cisco');
      });

      it('should return an empty vendors array when input is empty', () => {
        const result = VendorMapper.toListDTO([], 0);

        expect(result.vendors).toHaveLength(0);
      });

      it('should return vendor DTOs with string ids', () => {
        const result = VendorMapper.toListDTO([makeVendor({ id: VALID_UUID })], 1);

        expect(result.vendors[0].id).toBe(VALID_UUID);
      });
    });
  });
});
