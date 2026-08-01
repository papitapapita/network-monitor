// Source: src/infrastructure/mappers/DeviceMapper.ts

import { DeviceMapper } from '../../../src/infrastructure/mappers/DeviceMapper';
import { Device } from '../../../src/domain/device-inventory/aggregates/Device';
import { DeviceOwnerType } from '../../../src/domain/device-inventory/enums';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440001';
const VALID_UUID_3 = '550e8400-e29b-41d4-a716-446655440002';
const BASE_DATE = new Date('2024-01-01T00:00:00.000Z');
const UPDATED_DATE = new Date('2024-06-15T12:00:00.000Z');
const INSTALLED_DATE = new Date('2023-11-01T00:00:00.000Z');

function makeRawDevice(
  overrides: Record<string, unknown> = {}
): Parameters<typeof DeviceMapper.toDomain>[0] {
  return {
    id: VALID_UUID,
    deviceModelId: VALID_UUID_2,
    locationId: VALID_UUID_3,
    status: 'ACTIVE',
    category: 'GATEWAY',
    owner: 'COMPANY',
    name: 'Test Device',
    serialNumber: 'SN-001',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    ipAddress: '192.168.1.1',
    description: 'A test device',
    installedDate: INSTALLED_DATE,
    createdAt: BASE_DATE,
    updatedAt: UPDATED_DATE,
    monitoringEnabled: true,
    ...overrides
  } as Parameters<typeof DeviceMapper.toDomain>[0];
}

// ---------------------------------------------------------------------------

describe('DeviceMapper', () => {
  // =========================================================================
  describe('toDomain()', () => {
    // -----------------------------------------------------------------------
    describe('happy path — complete raw record', () => {
      it('should return a successful Result', () => {
        const raw = makeRawDevice();

        const result = DeviceMapper.toDomain(raw);

        expect(result.isSuccess).toBe(true);
      });

      it('should return a Device instance', () => {
        const raw = makeRawDevice();

        const result = DeviceMapper.toDomain(raw);

        expect(result.value).toBeInstanceOf(Device);
      });

      it('should map id to a DeviceId with the same string value', () => {
        const raw = makeRawDevice();

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.id.toString()).toBe(VALID_UUID);
      });

      it('should map deviceModelId to the correct string value', () => {
        const raw = makeRawDevice();

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.deviceModelId.toString()).toBe(
          VALID_UUID_2
        );
      });

      it('should map locationId to the correct string value when present', () => {
        const raw = makeRawDevice({ locationId: VALID_UUID_3 });

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.locationId).not.toBeNull();
        expect(result.value.locationId!.toString()).toBe(
          VALID_UUID_3
        );
      });

      it('should map name correctly', () => {
        const raw = makeRawDevice({ name: 'Core-Router-01' });

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.name.toString()).toBe('Core-Router-01');
      });

      it('should map status correctly', () => {
        const raw = makeRawDevice({ status: 'ACTIVE' });

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.status.toString()).toBe('ACTIVE');
      });

      it('should map serialNumber correctly when present', () => {
        const raw = makeRawDevice({ serialNumber: 'SN-001' });

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.serialNumber).not.toBeNull();
        expect(result.value.serialNumber!.toString()).toBe('SN-001');
      });

      it('should map macAddress correctly when present', () => {
        const raw = makeRawDevice({
          macAddress: 'AA:BB:CC:DD:EE:FF'
        });

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.macAddress).not.toBeNull();
        expect(result.value.macAddress!.toString()).toBe(
          'AA:BB:CC:DD:EE:FF'
        );
      });

      it('should map ipAddress correctly when present', () => {
        const raw = makeRawDevice({ ipAddress: '192.168.1.1' });

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.ipAddress).not.toBeNull();
        expect(result.value.ipAddress!.toString()).toBe(
          '192.168.1.1'
        );
      });

      it('should map description correctly when present', () => {
        const raw = makeRawDevice({ description: 'A test device' });

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.description).toBe('A test device');
      });

      it('should map installedDate correctly when present', () => {
        const raw = makeRawDevice({ installedDate: INSTALLED_DATE });

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.installedDate).toEqual(INSTALLED_DATE);
      });

      it('should map createdAt correctly', () => {
        const raw = makeRawDevice();

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.createdAt).toEqual(BASE_DATE);
      });

      it('should map updatedAt correctly', () => {
        const raw = makeRawDevice();

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.updatedAt).toEqual(UPDATED_DATE);
      });

      it('should map monitoringEnabled correctly when true', () => {
        const raw = makeRawDevice({ monitoringEnabled: true });

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.monitoringEnabled).toBe(true);
      });

      it('should map monitoringEnabled correctly when false', () => {
        const raw = makeRawDevice({ monitoringEnabled: false });

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.monitoringEnabled).toBe(false);
      });

      it('should produce a Device with no domain events (reconstitution path)', () => {
        const raw = makeRawDevice();

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.domainEvents.length).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('nullable fields — all null', () => {
      it('should set locationId to null when raw.locationId is null', () => {
        const raw = makeRawDevice({ locationId: null });

        const result = DeviceMapper.toDomain(raw);

        expect(result.isSuccess).toBe(true);
        expect(result.value.locationId).toBeNull();
      });

      it('should set category to null when raw.category is null', () => {
        const raw = makeRawDevice({ category: null });

        const result = DeviceMapper.toDomain(raw);

        expect(result.isSuccess).toBe(true);
        expect(result.value.category).toBeNull();
      });

      it('should set serialNumber to null when raw.serialNumber is null', () => {
        const raw = makeRawDevice({ serialNumber: null });

        const result = DeviceMapper.toDomain(raw);

        expect(result.isSuccess).toBe(true);
        expect(result.value.serialNumber).toBeNull();
      });

      it('should set macAddress to null when raw.macAddress is null', () => {
        const raw = makeRawDevice({ macAddress: null });

        const result = DeviceMapper.toDomain(raw);

        expect(result.isSuccess).toBe(true);
        expect(result.value.macAddress).toBeNull();
      });

      it('should set ipAddress to null when raw.ipAddress is null', () => {
        const raw = makeRawDevice({ ipAddress: null });

        const result = DeviceMapper.toDomain(raw);

        expect(result.isSuccess).toBe(true);
        expect(result.value.ipAddress).toBeNull();
      });

      it('should set description to null when raw.description is null', () => {
        const raw = makeRawDevice({ description: null });

        const result = DeviceMapper.toDomain(raw);

        expect(result.isSuccess).toBe(true);
        expect(result.value.description).toBeNull();
      });

      it('should set installedDate to null when raw.installedDate is null', () => {
        const raw = makeRawDevice({ installedDate: null });

        const result = DeviceMapper.toDomain(raw);

        expect(result.isSuccess).toBe(true);
        expect(result.value.installedDate).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    describe('nullable fields — all populated', () => {
      it('should map locationId when present', () => {
        const raw = makeRawDevice({ locationId: VALID_UUID_3 });

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.locationId).not.toBeNull();
        expect(result.value.locationId!.toString()).toBe(
          VALID_UUID_3
        );
      });

      it('should map category when present', () => {
        const raw = makeRawDevice({ category: 'AGGREGATION_SWITCH' });

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.category).not.toBeNull();
        expect(result.value.category!.toString()).toBe(
          'AGGREGATION_SWITCH'
        );
      });

      it('should map serialNumber when present', () => {
        const raw = makeRawDevice({ serialNumber: 'SN-XYZ-9999' });

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.serialNumber).not.toBeNull();
        expect(result.value.serialNumber!.toString()).toBe(
          'SN-XYZ-9999'
        );
      });

      it('should map macAddress when present', () => {
        const raw = makeRawDevice({
          macAddress: '11:22:33:44:55:66'
        });

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.macAddress).not.toBeNull();
        expect(result.value.macAddress!.toString()).toBe(
          '11:22:33:44:55:66'
        );
      });

      it('should map ipAddress when present', () => {
        const raw = makeRawDevice({ ipAddress: '10.0.0.1' });

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.ipAddress).not.toBeNull();
        expect(result.value.ipAddress!.toString()).toBe('10.0.0.1');
      });

      it('should map description when present', () => {
        const raw = makeRawDevice({
          description: 'Core switch for building A'
        });

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.description).toBe(
          'Core switch for building A'
        );
      });

      it('should map installedDate when present', () => {
        const raw = makeRawDevice({ installedDate: INSTALLED_DATE });

        const result = DeviceMapper.toDomain(raw);

        expect(result.value.installedDate).toEqual(INSTALLED_DATE);
      });
    });

    // -----------------------------------------------------------------------
    describe('failure — invalid device ID', () => {
      it('should return a failed Result when raw.id is not a valid UUID', () => {
        const raw = makeRawDevice({ id: 'not-a-uuid' });

        const result = DeviceMapper.toDomain(raw);

        expect(result.isFailure).toBe(true);
      });

      it('should include "Invalid device ID" in the error message', () => {
        const raw = makeRawDevice({ id: 'not-a-uuid' });

        const result = DeviceMapper.toDomain(raw);

        expect(result.error).toContain('Invalid device ID');
      });

      it('should return a failed Result when raw.id is an empty string', () => {
        const raw = makeRawDevice({ id: '' });

        const result = DeviceMapper.toDomain(raw);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid device ID');
      });
    });

    // -----------------------------------------------------------------------
    describe('failure — invalid deviceModelId', () => {
      it('should return a failed Result when raw.deviceModelId is not a valid UUID', () => {
        const raw = makeRawDevice({ deviceModelId: 'not-a-uuid' });

        const result = DeviceMapper.toDomain(raw);

        expect(result.isFailure).toBe(true);
      });

      it('should include "Invalid device model ID" in the error message', () => {
        const raw = makeRawDevice({ deviceModelId: 'bad-id' });

        const result = DeviceMapper.toDomain(raw);

        expect(result.error).toContain('Invalid device model ID');
      });

      it('should return a failed Result when raw.deviceModelId is an empty string', () => {
        const raw = makeRawDevice({ deviceModelId: '' });

        const result = DeviceMapper.toDomain(raw);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid device model ID');
      });
    });

    // -----------------------------------------------------------------------
    describe('failure — invalid locationId when present', () => {
      it('should return a failed Result when raw.locationId is present but not a valid UUID', () => {
        const raw = makeRawDevice({ locationId: 'not-a-uuid' });

        const result = DeviceMapper.toDomain(raw);

        expect(result.isFailure).toBe(true);
      });

      it('should include "Invalid location ID" in the error message', () => {
        const raw = makeRawDevice({ locationId: 'bad-location-id' });

        const result = DeviceMapper.toDomain(raw);

        expect(result.error).toContain('Invalid location ID');
      });

      it('should not fail when raw.locationId is null (null is valid absence)', () => {
        const raw = makeRawDevice({ locationId: null });

        const result = DeviceMapper.toDomain(raw);

        expect(result.isSuccess).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('DeviceOwnerType mapping from Prisma string', () => {
      it('should map owner "COMPANY" to DeviceOwnerType.COMPANY', () => {
        const raw = makeRawDevice({ owner: 'COMPANY' });

        const result = DeviceMapper.toDomain(raw);

        expect(result.isSuccess).toBe(true);
        expect(result.value.ownerType).toBe(DeviceOwnerType.COMPANY);
      });

      it('should map owner "CLIENT" to DeviceOwnerType.CLIENT', () => {
        const raw = makeRawDevice({ owner: 'CLIENT' });

        const result = DeviceMapper.toDomain(raw);

        expect(result.isSuccess).toBe(true);
        expect(result.value.ownerType).toBe(DeviceOwnerType.CLIENT);
      });

      it('should throw when raw.owner is an unrecognised value', () => {
        const raw = makeRawDevice({ owner: 'PARTNER' });

        expect(() => DeviceMapper.toDomain(raw)).toThrow(
          'Data integrity violation: unrecognised DeviceOwnerType "PARTNER" in persistence store'
        );
      });

      it('should throw when raw.owner is an empty string', () => {
        const raw = makeRawDevice({ owner: '' });

        expect(() => DeviceMapper.toDomain(raw)).toThrow();
      });

      it('should throw for lowercase owner string "company"', () => {
        const raw = makeRawDevice({ owner: 'company' });

        expect(() => DeviceMapper.toDomain(raw)).toThrow();
      });
    });

    // -----------------------------------------------------------------------
    describe('DeviceStatus mapping from Prisma string', () => {
      const statusMatrix: string[] = [
        'ACTIVE',
        'DAMAGED',
        'DECOMMISSIONED',
        'INVENTORY',
        'MAINTENANCE'
      ];

      for (const status of statusMatrix) {
        it(`should map Prisma status "${status}" to the correct DeviceStatus`, () => {
          const raw = makeRawDevice({ status });

          const result = DeviceMapper.toDomain(raw);

          expect(result.isSuccess).toBe(true);
          expect(result.value.status.toString()).toBe(status);
        });
      }
    });

    // -----------------------------------------------------------------------
    describe('DeviceCategory mapping from Prisma string', () => {
      const categoryMatrix: string[] = [
        'CPE',
        'WIRELESS_CPE',
        'ACCESS_POINT',
        'GATEWAY',
        'AGGREGATION_SWITCH',
        'OTHER'
      ];

      for (const category of categoryMatrix) {
        it(`should map Prisma category "${category}" to the correct DeviceCategory`, () => {
          const raw = makeRawDevice({ category });

          const result = DeviceMapper.toDomain(raw);

          expect(result.isSuccess).toBe(true);
          expect(result.value.category).not.toBeNull();
          expect(result.value.category!.toString()).toBe(category);
        });
      }

      it('should throw when raw.category is an unrecognised value', () => {
        const raw = makeRawDevice({ category: 'TELEPORTER' });

        expect(() => DeviceMapper.toDomain(raw)).toThrow(
          'Data integrity violation: unrecognised DeviceCategory "TELEPORTER" in persistence store'
        );
      });

      it('should throw for a category retired by the DEV-043 recast', () => {
        const raw = makeRawDevice({ category: 'SMART_SWITCH_POE' });

        expect(() => DeviceMapper.toDomain(raw)).toThrow(
          'Data integrity violation: unrecognised DeviceCategory "SMART_SWITCH_POE" in persistence store'
        );
      });

      it('should throw when raw.category is an empty string', () => {
        const raw = makeRawDevice({ category: '' });

        expect(() => DeviceMapper.toDomain(raw)).toThrow();
      });

      it('should throw for a lowercase category string "gateway"', () => {
        const raw = makeRawDevice({ category: 'gateway' });

        expect(() => DeviceMapper.toDomain(raw)).toThrow();
      });
    });
  });

  // =========================================================================
  describe('toPersistence()', () => {
    // -----------------------------------------------------------------------
    describe('happy path — fully populated Device', () => {
      function buildDevice(): Device {
        const domainResult = DeviceMapper.toDomain(makeRawDevice());
        if (domainResult.isFailure) {
          throw new Error(`Test setup failed: ${domainResult.error}`);
        }
        return domainResult.value;
      }

      it('should serialize id as a string', () => {
        const device = buildDevice();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.id).toBe(VALID_UUID);
      });

      it('should serialize deviceModelId as a string', () => {
        const device = buildDevice();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.deviceModelId).toBe(VALID_UUID_2);
      });

      it('should serialize locationId correctly when present', () => {
        const device = buildDevice();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.locationId).toBe(VALID_UUID_3);
      });

      it('should serialize status as a string', () => {
        const device = buildDevice();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.status).toBe('ACTIVE');
      });

      it('should serialize category as a string when present', () => {
        const device = buildDevice();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.category).toBe('GATEWAY');
      });

      it('should use the field name "owner" (not "ownerType") for the Prisma column', () => {
        const device = buildDevice();

        const raw = DeviceMapper.toPersistence(device);

        expect(
          Object.prototype.hasOwnProperty.call(raw, 'owner')
        ).toBe(true);
        expect(
          Object.prototype.hasOwnProperty.call(raw, 'ownerType')
        ).toBe(false);
      });

      it('should serialize the owner field as the string value of DeviceOwnerType', () => {
        const device = buildDevice();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.owner).toBe('COMPANY');
      });

      it('should serialize name as a string', () => {
        const device = buildDevice();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.name).toBe('Test Device');
      });

      it('should serialize serialNumber correctly when present', () => {
        const device = buildDevice();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.serialNumber).toBe('SN-001');
      });

      it('should serialize macAddress correctly when present', () => {
        const device = buildDevice();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.macAddress).toBe('AA:BB:CC:DD:EE:FF');
      });

      it('should serialize ipAddress correctly when present', () => {
        const device = buildDevice();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.ipAddress).toBe('192.168.1.1');
      });

      it('should serialize description correctly when present', () => {
        const device = buildDevice();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.description).toBe('A test device');
      });

      it('should serialize installedDate correctly when present', () => {
        const device = buildDevice();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.installedDate).toEqual(INSTALLED_DATE);
      });

      it('should serialize createdAt correctly', () => {
        const device = buildDevice();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.createdAt).toEqual(BASE_DATE);
      });

      it('should serialize updatedAt correctly', () => {
        const device = buildDevice();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.updatedAt).toEqual(UPDATED_DATE);
      });

      it('should serialize monitoringEnabled correctly', () => {
        const device = buildDevice();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.monitoringEnabled).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('nullable domain fields produce null (not undefined)', () => {
      function buildDeviceWithNulls(): Device {
        const domainResult = DeviceMapper.toDomain(
          makeRawDevice({
            locationId: null,
            category: null,
            serialNumber: null,
            macAddress: null,
            ipAddress: null,
            description: null,
            installedDate: null
          })
        );
        if (domainResult.isFailure) {
          throw new Error(`Test setup failed: ${domainResult.error}`);
        }
        return domainResult.value;
      }

      it('should serialize locationId as null when the domain field is null', () => {
        const device = buildDeviceWithNulls();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.locationId).toBeNull();
      });

      it('should serialize category as null when the domain field is null', () => {
        const device = buildDeviceWithNulls();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.category).toBeNull();
      });

      it('should serialize serialNumber as null when the domain field is null', () => {
        const device = buildDeviceWithNulls();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.serialNumber).toBeNull();
      });

      it('should serialize macAddress as null when the domain field is null', () => {
        const device = buildDeviceWithNulls();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.macAddress).toBeNull();
      });

      it('should serialize ipAddress as null when the domain field is null', () => {
        const device = buildDeviceWithNulls();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.ipAddress).toBeNull();
      });

      it('should serialize description as null when the domain field is null', () => {
        const device = buildDeviceWithNulls();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.description).toBeNull();
      });

      it('should serialize installedDate as null when the domain field is null', () => {
        const device = buildDeviceWithNulls();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.installedDate).toBeNull();
      });

      it('locationId null value should be strictly null, not undefined', () => {
        const device = buildDeviceWithNulls();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.locationId).toStrictEqual(null);
      });

      it('category null value should be strictly null, not undefined', () => {
        const device = buildDeviceWithNulls();

        const raw = DeviceMapper.toPersistence(device);

        expect(raw.category).toStrictEqual(null);
      });
    });

    // -----------------------------------------------------------------------
    describe('CLIENT owner round-trip', () => {
      it('should serialize CLIENT owner correctly', () => {
        const domainResult = DeviceMapper.toDomain(
          makeRawDevice({ owner: 'CLIENT' })
        );
        expect(domainResult.isSuccess).toBe(true);

        const raw = DeviceMapper.toPersistence(domainResult.value);

        expect(raw.owner).toBe('CLIENT');
      });
    });

    // -----------------------------------------------------------------------
    describe('round-trip — toDomain → toPersistence', () => {
      it('should reproduce all scalar fields after a round-trip', () => {
        const originalRaw = makeRawDevice();

        const domainResult = DeviceMapper.toDomain(originalRaw);
        expect(domainResult.isSuccess).toBe(true);

        const serialized = DeviceMapper.toPersistence(
          domainResult.value
        );

        expect(serialized.id).toBe(originalRaw.id);
        expect(serialized.deviceModelId).toBe(
          originalRaw.deviceModelId
        );
        expect(serialized.locationId).toBe(originalRaw.locationId);
        expect(serialized.status).toBe(originalRaw.status);
        expect(serialized.category).toBe(originalRaw.category);
        expect(serialized.owner).toBe(originalRaw.owner);
        expect(serialized.name).toBe(originalRaw.name);
        expect(serialized.serialNumber).toBe(
          originalRaw.serialNumber
        );
        expect(serialized.macAddress).toBe(originalRaw.macAddress);
        expect(serialized.ipAddress).toBe(originalRaw.ipAddress);
        expect(serialized.description).toBe(originalRaw.description);
        expect(serialized.monitoringEnabled).toBe(
          originalRaw.monitoringEnabled
        );
      });

      it('should preserve null nullable fields after a round-trip', () => {
        const originalRaw = makeRawDevice({
          locationId: null,
          category: null,
          serialNumber: null,
          macAddress: null,
          ipAddress: null,
          description: null,
          installedDate: null
        });

        const domainResult = DeviceMapper.toDomain(originalRaw);
        expect(domainResult.isSuccess).toBe(true);

        const serialized = DeviceMapper.toPersistence(
          domainResult.value
        );

        expect(serialized.locationId).toBeNull();
        expect(serialized.category).toBeNull();
        expect(serialized.serialNumber).toBeNull();
        expect(serialized.macAddress).toBeNull();
        expect(serialized.ipAddress).toBeNull();
        expect(serialized.description).toBeNull();
        expect(serialized.installedDate).toBeNull();
      });
    });
  });
});
