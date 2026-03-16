// Source: src/application/device-inventory/mappers/DeviceMapper.ts
import { IPAddress } from 'domain/shared';
import { DeviceMapper } from 'application/device-inventory/mappers';
import { Device } from 'domain/device-inventory/aggregates';
import {
  DeviceName,
  DeviceStatus,
  DeviceCategory,
  MACAddress,
  SerialNumber
} from 'domain/device-inventory/value-objects';
import { DeviceOwnerType } from 'domain/device-inventory/enums';
import {
  DeviceId,
  LocationId,
  DeviceModelId
} from 'domain/shared/ids';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440001';
const VALID_UUID_3 = '550e8400-e29b-41d4-a716-446655440002';
const BASE_DATE = new Date('2024-01-01T00:00:00.000Z');
const INSTALLED_DATE = new Date('2023-11-01T00:00:00.000Z');

function makeDevice(
  overrides: Partial<Parameters<typeof Device.reconstitute>[1]> = {}
): Device {
  const id = DeviceId.parse(VALID_UUID).value!;
  const modelId = DeviceModelId.parse(VALID_UUID_2).value!;
  const locationId = LocationId.parse(VALID_UUID_3).value!;

  return Device.reconstitute(id, {
    deviceModelId: modelId,
    locationId,
    name: DeviceName.reconstitute('Core-Router-01'),
    status: DeviceStatus.reconstitute('ACTIVE'),
    category: DeviceCategory.reconstitute('CORE'),
    ownerType: DeviceOwnerType.COMPANY,
    serialNumber: SerialNumber.reconstitute('SN-001'),
    macAddress: MACAddress.reconstitute('AA:BB:CC:DD:EE:FF'),
    ipAddress: IPAddress.reconstitute('192.168.1.1'),
    description: 'A test device',
    installedDate: INSTALLED_DATE,
    monitoringEnabled: true,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    ...overrides
  });
}

function makeMinimalDevice(): Device {
  return makeDevice({
    locationId: null,
    category: null,
    serialNumber: null,
    macAddress: null,
    ipAddress: null,
    description: null,
    installedDate: null,
    monitoringEnabled: false
  });
}

// ---------------------------------------------------------------------------

describe('DeviceMapper (application layer)', () => {
  // =========================================================================
  describe('toDTO()', () => {
    // -----------------------------------------------------------------------
    describe('happy path — fully populated Device', () => {
      it('should map id to string', () => {
        const device = makeDevice();

        const dto = DeviceMapper.toDTO(device);

        expect(dto.id).toBe(VALID_UUID);
      });

      it('should map deviceModelId to string', () => {
        const device = makeDevice();

        const dto = DeviceMapper.toDTO(device);

        expect(dto.deviceModelId).toBe(VALID_UUID_2);
      });

      it('should map locationId to string when present', () => {
        const device = makeDevice();

        const dto = DeviceMapper.toDTO(device);

        expect(dto.locationId).toBe(VALID_UUID_3);
      });

      it('should map status to its string value', () => {
        const device = makeDevice();

        const dto = DeviceMapper.toDTO(device);

        expect(dto.status).toBe('ACTIVE');
      });

      it('should map category to its string value when present', () => {
        const device = makeDevice();

        const dto = DeviceMapper.toDTO(device);

        expect(dto.category).toBe('CORE');
      });

      it('should map ownerType as a string', () => {
        const device = makeDevice();

        const dto = DeviceMapper.toDTO(device);

        expect(dto.ownerType).toBe('COMPANY');
      });

      it('should map name to its string value', () => {
        const device = makeDevice();

        const dto = DeviceMapper.toDTO(device);

        expect(dto.name).toBe('Core-Router-01');
      });

      it('should map serialNumber to its string value when present', () => {
        const device = makeDevice();

        const dto = DeviceMapper.toDTO(device);

        expect(dto.serialNumber).toBe('SN-001');
      });

      it('should map macAddress to its string value when present', () => {
        const device = makeDevice();

        const dto = DeviceMapper.toDTO(device);

        expect(dto.macAddress).toBe('AA:BB:CC:DD:EE:FF');
      });

      it('should map ipAddress to its string value when present', () => {
        const device = makeDevice();

        const dto = DeviceMapper.toDTO(device);

        expect(dto.ipAddress).toBe('192.168.1.1');
      });

      it('should map description as a string when present', () => {
        const device = makeDevice();

        const dto = DeviceMapper.toDTO(device);

        expect(dto.description).toBe('A test device');
      });

      it('should map installedDate to ISO 8601 string when present', () => {
        const device = makeDevice();

        const dto = DeviceMapper.toDTO(device);

        expect(dto.installedDate).toBe(INSTALLED_DATE.toISOString());
      });

      it('should map monitoringEnabled when true', () => {
        const device = makeDevice({ monitoringEnabled: true });

        const dto = DeviceMapper.toDTO(device);

        expect(dto.monitoringEnabled).toBe(true);
      });

      it('should map monitoringEnabled when false', () => {
        const device = makeDevice({ monitoringEnabled: false });

        const dto = DeviceMapper.toDTO(device);

        expect(dto.monitoringEnabled).toBe(false);
      });

      it('should map createdAt to ISO 8601 string', () => {
        const device = makeDevice();

        const dto = DeviceMapper.toDTO(device);

        expect(dto.createdAt).toBe(BASE_DATE.toISOString());
      });

      it('should map updatedAt to ISO 8601 string', () => {
        const device = makeDevice();

        const dto = DeviceMapper.toDTO(device);

        expect(dto.updatedAt).toBe(BASE_DATE.toISOString());
      });
    });

    // -----------------------------------------------------------------------
    describe('nullable fields — all null', () => {
      it('should map locationId to null when device has no location', () => {
        const device = makeDevice({ locationId: null });

        const dto = DeviceMapper.toDTO(device);

        expect(dto.locationId).toBeNull();
      });

      it('should map category to null when device has no category', () => {
        const device = makeDevice({ category: null });

        const dto = DeviceMapper.toDTO(device);

        expect(dto.category).toBeNull();
      });

      it('should map serialNumber to null when not set', () => {
        const device = makeDevice({ serialNumber: null });

        const dto = DeviceMapper.toDTO(device);

        expect(dto.serialNumber).toBeNull();
      });

      it('should map macAddress to null when not set', () => {
        const device = makeDevice({ macAddress: null });

        const dto = DeviceMapper.toDTO(device);

        expect(dto.macAddress).toBeNull();
      });

      it('should map ipAddress to null when not set', () => {
        const device = makeDevice({ ipAddress: null });

        const dto = DeviceMapper.toDTO(device);

        expect(dto.ipAddress).toBeNull();
      });

      it('should map description to null when not set', () => {
        const device = makeDevice({ description: null });

        const dto = DeviceMapper.toDTO(device);

        expect(dto.description).toBeNull();
      });

      it('should map installedDate to null when not set', () => {
        const device = makeDevice({ installedDate: null });

        const dto = DeviceMapper.toDTO(device);

        expect(dto.installedDate).toBeNull();
      });

      it('null values should be strictly null, not undefined', () => {
        const device = makeMinimalDevice();

        const dto = DeviceMapper.toDTO(device);

        expect(dto.locationId).toStrictEqual(null);
        expect(dto.category).toStrictEqual(null);
        expect(dto.serialNumber).toStrictEqual(null);
        expect(dto.macAddress).toStrictEqual(null);
        expect(dto.ipAddress).toStrictEqual(null);
        expect(dto.description).toStrictEqual(null);
        expect(dto.installedDate).toStrictEqual(null);
      });
    });

    // -----------------------------------------------------------------------
    describe('DeviceStatus string values', () => {
      const statuses = [
        'ACTIVE',
        'DAMAGED',
        'DECOMMISSIONED',
        'INVENTORY',
        'MAINTENANCE'
      ] as const;

      for (const status of statuses) {
        it(`should map status "${status}" correctly`, () => {
          const device = makeDevice({
            status: DeviceStatus.reconstitute(status)
          });

          const dto = DeviceMapper.toDTO(device);

          expect(dto.status).toBe(status);
        });
      }
    });

    // -----------------------------------------------------------------------
    describe('DeviceCategory string values', () => {
      const categories = [
        'CORE',
        'DISTRIBUTION',
        'POE',
        'ACCESS_POINT',
        'CLIENT_CPE'
      ] as const;

      for (const category of categories) {
        it(`should map category "${category}" correctly`, () => {
          const device = makeDevice({
            category: DeviceCategory.reconstitute(category)
          });

          const dto = DeviceMapper.toDTO(device);

          expect(dto.category).toBe(category);
        });
      }
    });

    // -----------------------------------------------------------------------
    describe('DeviceOwnerType string values', () => {
      it('should map COMPANY owner', () => {
        const device = makeDevice({
          ownerType: DeviceOwnerType.COMPANY
        });

        const dto = DeviceMapper.toDTO(device);

        expect(dto.ownerType).toBe('COMPANY');
      });

      it('should map CLIENT owner', () => {
        const device = makeDevice({
          ownerType: DeviceOwnerType.CLIENT
        });

        const dto = DeviceMapper.toDTO(device);

        expect(dto.ownerType).toBe('CLIENT');
      });
    });
  });

  // =========================================================================
  describe('toListDTO()', () => {
    function makeDevicePage(count: number): Device[] {
      return Array.from({ length: count }, () => makeDevice());
    }

    // -----------------------------------------------------------------------
    describe('pagination metadata', () => {
      it('should include total count in the response', () => {
        const devices = makeDevicePage(5);

        const dto = DeviceMapper.toListDTO(devices, 42, 20, 0);

        expect(dto.total).toBe(42);
      });

      it('should include limit in the response', () => {
        const devices = makeDevicePage(5);

        const dto = DeviceMapper.toListDTO(devices, 42, 20, 0);

        expect(dto.limit).toBe(20);
      });

      it('should include offset in the response', () => {
        const devices = makeDevicePage(5);

        const dto = DeviceMapper.toListDTO(devices, 42, 20, 20);

        expect(dto.offset).toBe(20);
      });

      it('should default limit to 20 when omitted', () => {
        const devices = makeDevicePage(3);

        const dto = DeviceMapper.toListDTO(devices, 3);

        expect(dto.limit).toBe(20);
      });

      it('should default offset to 0 when omitted', () => {
        const devices = makeDevicePage(3);

        const dto = DeviceMapper.toListDTO(devices, 3);

        expect(dto.offset).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('hasMore flag', () => {
      it('should be true when there are more items beyond the current page', () => {
        const devices = makeDevicePage(20);

        const dto = DeviceMapper.toListDTO(devices, 50, 20, 0);

        expect(dto.hasMore).toBe(true);
      });

      it('should be false when the current page covers all remaining items', () => {
        const devices = makeDevicePage(10);

        const dto = DeviceMapper.toListDTO(devices, 30, 20, 20);

        expect(dto.hasMore).toBe(false);
      });

      it('should be false when total equals page size', () => {
        const devices = makeDevicePage(20);

        const dto = DeviceMapper.toListDTO(devices, 20, 20, 0);

        expect(dto.hasMore).toBe(false);
      });

      it('should be false for an empty result set', () => {
        const dto = DeviceMapper.toListDTO([], 0, 20, 0);

        expect(dto.hasMore).toBe(false);
      });
    });

    // -----------------------------------------------------------------------
    describe('devices array', () => {
      it('should map each device to a DeviceResponseDTO', () => {
        const devices = makeDevicePage(3);

        const dto = DeviceMapper.toListDTO(devices, 3, 20, 0);

        expect(dto.devices).toHaveLength(3);
        dto.devices.forEach((d) => {
          expect(d.id).toBeDefined();
          expect(d.name).toBeDefined();
          expect(d.status).toBeDefined();
        });
      });

      it('should return an empty devices array when the page is empty', () => {
        const dto = DeviceMapper.toListDTO([], 0, 20, 0);

        expect(dto.devices).toEqual([]);
      });
    });
  });
});
