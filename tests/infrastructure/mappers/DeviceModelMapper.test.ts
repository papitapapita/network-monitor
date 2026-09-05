// Source: src/infrastructure/mappers/DeviceModelMapper.ts

import { describe, it, expect, afterEach } from '@jest/globals';
import { DeviceModelMapper } from '../../../src/infrastructure/mappers/DeviceModelMapper';
import { DeviceModel } from '../../../src/domain/device-inventory/aggregates/DeviceModel';
import { DeviceType } from '../../../src/domain/device-inventory/value-objects';
import {
  DeviceModelId,
  VendorId
} from '../../../src/domain/shared/ids';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VENDOR_UUID = '550e8400-e29b-41d4-a716-446655440001';
const NOW = new Date('2024-01-01T00:00:00.000Z');

type PrismaDeviceModelRecord = {
  id: string;
  vendorId: string;
  model: string;
  deviceType: string;
  isWireless: boolean;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  vendor: { name: string; slug: string };
};

function makeRaw(
  overrides: Partial<PrismaDeviceModelRecord> = {}
): PrismaDeviceModelRecord {
  return {
    id: VALID_UUID,
    vendorId: VENDOR_UUID,
    model: 'RB760iGS',
    deviceType: 'ROUTER',
    isWireless: false,
    imageUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
    vendor: { name: 'Mikrotik', slug: 'mikrotik' },
    ...overrides
  };
}

function makeDeviceModel(
  overrides: Partial<{
    model: string;
    deviceType: string;
    isWireless: boolean;
    imageUrl: string | null;
    vendorName: string;
    vendorSlug: string;
  }> = {}
): DeviceModel {
  const id = DeviceModelId.parse(VALID_UUID).value!;
  const vendorId = VendorId.parse(VENDOR_UUID).value!;
  return DeviceModel.reconstitute(id, {
    vendorId,
    vendorName: overrides.vendorName ?? 'Mikrotik',
    vendorSlug: overrides.vendorSlug ?? 'mikrotik',
    model: overrides.model ?? 'RB760iGS',
    deviceType: DeviceType.reconstitute(
      overrides.deviceType ?? 'ROUTER'
    ),
    isWireless: overrides.isWireless ?? false,
    imageUrl: overrides.imageUrl ?? null,
    createdAt: NOW,
    updatedAt: NOW
  });
}

// ---------------------------------------------------------------------------

describe('DeviceModelMapper', () => {
  afterEach(() => {
    // Kept for structural consistency
  });

  // =========================================================================
  describe('toDomain()', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should return a Result with isSuccess=true for a valid raw record', () => {
        const raw = makeRaw();

        const result = DeviceModelMapper.toDomain(raw);

        expect(result.isSuccess).toBe(true);
      });

      it('should map id to a DeviceModelId whose string value equals the raw id', () => {
        const raw = makeRaw();

        const result = DeviceModelMapper.toDomain(raw);

        expect(result.value!.id.toString()).toBe(VALID_UUID);
      });

      it('should map vendorId to a VendorId whose string value equals the raw vendorId', () => {
        const raw = makeRaw();

        const result = DeviceModelMapper.toDomain(raw);

        expect(result.value!.vendorId.toString()).toBe(VENDOR_UUID);
      });

      it('should map model correctly', () => {
        const raw = makeRaw({ model: 'CCR2004-1G-12S+2XS' });

        const result = DeviceModelMapper.toDomain(raw);

        expect(result.value!.model).toBe('CCR2004-1G-12S+2XS');
      });

      it('should map deviceType correctly', () => {
        const raw = makeRaw({ deviceType: 'SWITCH' });

        const result = DeviceModelMapper.toDomain(raw);

        expect(result.value!.deviceType.value).toBe('SWITCH');
      });

      it('should map vendorName from the vendor join field', () => {
        const raw = makeRaw({
          vendor: { name: 'Ubiquiti', slug: 'ubiquiti' }
        });

        const result = DeviceModelMapper.toDomain(raw);

        expect(result.value!.vendorName).toBe('Ubiquiti');
      });

      it('should map vendorSlug from the vendor join field', () => {
        const raw = makeRaw({
          vendor: { name: 'Ubiquiti', slug: 'ubiquiti' }
        });

        const result = DeviceModelMapper.toDomain(raw);

        expect(result.value!.vendorSlug).toBe('ubiquiti');
      });

      it('should map createdAt as a Date equal to the raw value', () => {
        const raw = makeRaw();

        const result = DeviceModelMapper.toDomain(raw);

        expect(result.value!.createdAt).toEqual(NOW);
      });

      it('should map updatedAt as a Date equal to the raw value', () => {
        const raw = makeRaw();

        const result = DeviceModelMapper.toDomain(raw);

        expect(result.value!.updatedAt).toEqual(NOW);
      });

      it('should map imageUrl correctly', () => {
        const raw = makeRaw({
          imageUrl: 'https://example.com/camera.jpg'
        });

        const result = DeviceModelMapper.toDomain(raw);

        expect(result.value!.imageUrl).toBe(
          'https://example.com/camera.jpg'
        );
      });

      it('should map a null imageUrl as null', () => {
        const raw = makeRaw();

        const result = DeviceModelMapper.toDomain(raw);

        expect(result.value!.imageUrl).toBeNull();
      });

      it('should return a DeviceModel with no domain events (reconstitution path)', () => {
        const raw = makeRaw();

        const result = DeviceModelMapper.toDomain(raw);

        expect(result.value!.domainEvents.length).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('failure — invalid id', () => {
      it('should return isFailure=true when id is not a valid UUID', () => {
        const raw = makeRaw({ id: 'not-a-uuid' });

        const result = DeviceModelMapper.toDomain(raw);

        expect(result.isFailure).toBe(true);
      });

      it('should include "Invalid device model ID" in the error message', () => {
        const raw = makeRaw({ id: 'bad-id' });

        const result = DeviceModelMapper.toDomain(raw);

        expect(result.error).toContain('Invalid device model ID');
      });
    });

    // -----------------------------------------------------------------------
    describe('failure — invalid vendorId', () => {
      it('should return isFailure=true when vendorId is not a valid UUID', () => {
        const raw = makeRaw({ vendorId: 'not-a-uuid' });

        const result = DeviceModelMapper.toDomain(raw);

        expect(result.isFailure).toBe(true);
      });

      it('should include "Invalid vendor ID" in the error message', () => {
        const raw = makeRaw({ vendorId: 'bad-vendor-id' });

        const result = DeviceModelMapper.toDomain(raw);

        expect(result.error).toContain('Invalid vendor ID');
      });
    });
  });

  // =========================================================================
  describe('toPersistence()', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should serialize id as the stringified DeviceModelId', () => {
        const dm = makeDeviceModel();

        const data = DeviceModelMapper.toPersistence(dm);

        expect(data.id).toBe(VALID_UUID);
      });

      it('should serialize vendorId as the stringified VendorId', () => {
        const dm = makeDeviceModel();

        const data = DeviceModelMapper.toPersistence(dm);

        expect(data.vendorId).toBe(VENDOR_UUID);
      });

      it('should serialize model correctly', () => {
        const dm = makeDeviceModel({ model: 'hEX S' });

        const data = DeviceModelMapper.toPersistence(dm);

        expect(data.model).toBe('hEX S');
      });

      it('should serialize deviceType correctly', () => {
        const dm = makeDeviceModel({ deviceType: 'ANTENNA' });

        const data = DeviceModelMapper.toPersistence(dm);

        expect(data.deviceType).toBe('ANTENNA');
      });

      it('should pass createdAt through as a Date object', () => {
        const dm = makeDeviceModel();

        const data = DeviceModelMapper.toPersistence(dm);

        expect(data.createdAt).toBeInstanceOf(Date);
        expect(data.createdAt).toEqual(NOW);
      });

      it('should pass updatedAt through as a Date object', () => {
        const dm = makeDeviceModel();

        const data = DeviceModelMapper.toPersistence(dm);

        expect(data.updatedAt).toBeInstanceOf(Date);
        expect(data.updatedAt).toEqual(NOW);
      });

      it('should NOT include vendorName in the persistence shape', () => {
        const dm = makeDeviceModel();

        const data = DeviceModelMapper.toPersistence(dm);

        expect(Object.keys(data)).not.toContain('vendorName');
      });

      it('should NOT include vendorSlug in the persistence shape', () => {
        const dm = makeDeviceModel();

        const data = DeviceModelMapper.toPersistence(dm);

        expect(Object.keys(data)).not.toContain('vendorSlug');
      });

      it('should include exactly the eight base fields in the persistence shape', () => {
        const dm = makeDeviceModel();

        const data = DeviceModelMapper.toPersistence(dm);

        expect(Object.keys(data).sort()).toEqual(
          [
            'createdAt',
            'deviceType',
            'id',
            'imageUrl',
            'isWireless',
            'model',
            'updatedAt',
            'vendorId'
          ].sort()
        );
      });

      it('should serialize imageUrl correctly', () => {
        const dm = makeDeviceModel({
          imageUrl: 'https://example.com/camera.jpg'
        });

        const data = DeviceModelMapper.toPersistence(dm);

        expect(data.imageUrl).toBe('https://example.com/camera.jpg');
      });

      it('should serialize a null imageUrl as null', () => {
        const dm = makeDeviceModel();

        const data = DeviceModelMapper.toPersistence(dm);

        expect(data.imageUrl).toBeNull();
      });
    });
  });

  // =========================================================================
  describe('round-trip — toDomain → toPersistence', () => {
    it('should reproduce id, vendorId, model, and deviceType after a round-trip', () => {
      const raw = makeRaw({ model: 'CRS326', deviceType: 'SWITCH' });

      const domainResult = DeviceModelMapper.toDomain(raw);
      expect(domainResult.isSuccess).toBe(true);

      const serialized = DeviceModelMapper.toPersistence(
        domainResult.value!
      );

      expect(serialized.id).toBe(raw.id);
      expect(serialized.vendorId).toBe(raw.vendorId);
      expect(serialized.model).toBe(raw.model);
      expect(serialized.deviceType).toBe(raw.deviceType);
    });

    it('should preserve date values after a round-trip', () => {
      const raw = makeRaw();

      const domainResult = DeviceModelMapper.toDomain(raw);
      const serialized = DeviceModelMapper.toPersistence(
        domainResult.value!
      );

      expect(serialized.createdAt).toEqual(NOW);
      expect(serialized.updatedAt).toEqual(NOW);
    });
  });
});
