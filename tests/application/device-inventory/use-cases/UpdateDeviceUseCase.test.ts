// Source: src/application/device-inventory/use-cases/UpdateDeviceUseCase.ts

import { IPAddress, MACAddress } from 'domain/shared';
import { UpdateDeviceUseCase } from '../../../../src/application/device-inventory/use-cases';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core';
import { Device } from '../../../../src/domain/device-inventory/aggregates';
import {
  DeviceName,
  DeviceStatus,
  SerialNumber
} from '../../../../src/domain/device-inventory/value-objects';
import { DeviceOwnerType } from '../../../../src/domain/device-inventory/enums';
import {
  DeviceId,
  DeviceModelId,
  LocationId
} from '../../../../src/domain/shared/ids';
import { UpdateDeviceRequestDTO } from '../../../../src/application/device-inventory/dtos';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_DEVICE_MODEL = '550e8400-e29b-41d4-a716-446655440001';
const VALID_LOCATION_ID = '550e8400-e29b-41d4-a716-446655440002';
const EXISTING_MAC = 'AA:BB:CC:DD:EE:FF';
const EXISTING_IP = '192.168.1.100';
const NOW = new Date('2024-06-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeLogger(): ILogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
}

function makeRepo(): jest.Mocked<IDeviceRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn(),
    findByLocation: jest.fn(),
    findByDeviceModel: jest.fn(),
    findByMacAddress: jest.fn(),
    findByIpAddress: jest.fn(),
    findByStatus: jest.fn(),
    existsByMacAddress: jest.fn(),
    existsByIpAddress: jest.fn(),
    findByLocationIds: jest.fn(),
    findByFilters: jest.fn()
  };
}

/**
 * Builds a Device reconstituted from persistence with the given status,
 * MAC, and IP already set. Defaults to INVENTORY status.
 */
function makePersistedDevice(
  overrides: {
    status?: string;
    macAddress?: string | null;
    ipAddress?: string | null;
    monitoringEnabled?: boolean;
    locationId?: string | null;
    serialNumber?: string | null;
  } = {}
): Device {
  const id = DeviceId.parse(VALID_DEVICE_ID).value;
  const modelId = DeviceModelId.parse(VALID_DEVICE_MODEL)
    .value as unknown as DeviceId;
  const statusStr = overrides.status ?? DeviceStatus.INVENTORY;
  const status = DeviceStatus.reconstitute(statusStr);
  const name = DeviceName.reconstitute('Core-Router-01');

  const macRaw = overrides.hasOwnProperty('macAddress')
    ? overrides.macAddress
    : EXISTING_MAC;
  const ipRaw = overrides.hasOwnProperty('ipAddress')
    ? overrides.ipAddress
    : EXISTING_IP;
  const macAddress = macRaw ? MACAddress.create(macRaw).value : null;
  const ipAddress = ipRaw ? IPAddress.create(ipRaw).value : null;
  const serialNumber = overrides.serialNumber
    ? SerialNumber.create(overrides.serialNumber).value
    : null;

  const locationId = overrides.hasOwnProperty('locationId')
    ? overrides.locationId
      ? LocationId.parse(overrides.locationId).value
      : null
    : null;

  return Device.reconstitute(id, {
    deviceModelId: modelId as unknown as DeviceModelId,
    locationId,
    status,
    category: null,
    ownerType: DeviceOwnerType.COMPANY,
    name,
    serialNumber,
    macAddress: macAddress ?? null,
    ipAddress: ipAddress ?? null,
    description: null,
    installedDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    monitoringEnabled: overrides.monitoringEnabled ?? false
  });
}

/** Minimal valid request DTO — only the required `id` field. */
function makeRequest(
  overrides: Partial<UpdateDeviceRequestDTO> = {}
): UpdateDeviceRequestDTO {
  return { id: VALID_DEVICE_ID, ...overrides };
}

// ---------------------------------------------------------------------------

describe('UpdateDeviceUseCase', () => {
  let repo: jest.Mocked<IDeviceRepository>;
  let logger: ILogger;
  let useCase: UpdateDeviceUseCase;

  beforeEach(() => {
    repo = makeRepo();
    logger = makeLogger();
    useCase = new UpdateDeviceUseCase(repo, logger);

    // Default happy-path mocks
    repo.findById.mockResolvedValue(Result.ok(makePersistedDevice()));
    repo.existsByMacAddress.mockResolvedValue(Result.ok(false));
    repo.existsByIpAddress.mockResolvedValue(Result.ok(false));
    repo.save.mockImplementation(async (device) => Result.ok(device));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('beforeExecute — validation', () => {
    it('should fail when id is an empty string', async () => {
      const result = await useCase.execute(makeRequest({ id: '' }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should fail when id is whitespace only', async () => {
      const result = await useCase.execute(
        makeRequest({ id: '   ' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should fail when ownerType is an invalid enum value', async () => {
      const result = await useCase.execute(
        makeRequest({ ownerType: 'PARTNER' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid ownerType');
      expect(result.error).toContain('PARTNER');
    });

    it('should fail when status is an invalid value', async () => {
      const result = await useCase.execute(
        makeRequest({ status: 'RETIRED' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('RETIRED');
    });

    it('should fail when category is an invalid non-null value', async () => {
      const result = await useCase.execute(
        makeRequest({ category: 'GATEWAY' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('GATEWAY');
    });

    it('should pass validation when category is null (null skips category validation)', async () => {
      const result = await useCase.execute(
        makeRequest({ category: null })
      );

      expect(result.isSuccess).toBe(true);
    });

    it('should not call findById when beforeExecute fails', async () => {
      await useCase.execute(makeRequest({ id: '' }));

      expect(repo.findById).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — ID parsing', () => {
    it('should fail when id is not a valid UUID', async () => {
      const result = await useCase.execute(
        makeRequest({ id: 'not-a-uuid' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });

    it('should fail when device is not found (findById returns null)', async () => {
      repo.findById.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device not found');
    });

    it('should fail when findById returns a failure Result', async () => {
      repo.findById.mockResolvedValue(
        Result.fail('DB connection lost')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB connection lost');
    });
  });

  // =========================================================================
  describe('executeImpl — status change', () => {
    it('should succeed when a valid status is provided', async () => {
      repo.findById.mockResolvedValue(
        Result.ok(makePersistedDevice({ locationId: VALID_LOCATION_ID }))
      );

      const result = await useCase.execute(
        makeRequest({ status: 'ACTIVE' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.status).toBe('ACTIVE');
    });

    it('should fail when trying to change status to ACTIVE without an IP address', async () => {
      repo.findById.mockResolvedValue(
        Result.ok(
          makePersistedDevice({ status: DeviceStatus.INVENTORY, ipAddress: null })
        )
      );

      const result = await useCase.execute(
        makeRequest({ status: 'ACTIVE' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('IP address');
    });

    it('should not call changeStatus when status is undefined', async () => {
      // We test this behaviorally: the device is returned unchanged at INVENTORY status
      repo.findById.mockResolvedValue(
        Result.ok(
          makePersistedDevice({ status: DeviceStatus.INVENTORY })
        )
      );

      const result = await useCase.execute(
        makeRequest({ status: undefined })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.status).toBe(DeviceStatus.INVENTORY);
    });
  });

  // =========================================================================
  describe('executeImpl — location assignment', () => {
    it('should succeed when locationId is a valid UUID string', async () => {
      const result = await useCase.execute(
        makeRequest({ locationId: VALID_LOCATION_ID })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.locationId).toBe(VALID_LOCATION_ID);
    });

    it('should succeed when locationId is null (unassign)', async () => {
      repo.findById.mockResolvedValue(
        Result.ok(
          makePersistedDevice({ locationId: VALID_LOCATION_ID })
        )
      );

      const result = await useCase.execute(
        makeRequest({ locationId: null })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.locationId).toBeNull();
    });

    it('should fail when locationId is an invalid UUID string', async () => {
      const result = await useCase.execute(
        makeRequest({ locationId: 'bad-uuid' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid locationId');
    });

    it('should not change locationId when locationId is undefined', async () => {
      // Device has no location; undefined means skip — locationId stays null
      const result = await useCase.execute(
        makeRequest({ locationId: undefined })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.locationId).toBeNull();
    });
  });

  // =========================================================================
  describe('executeImpl — monitoring toggle', () => {
    it('should enable monitoring when monitoringEnabled is true', async () => {
      repo.findById.mockResolvedValue(
        Result.ok(makePersistedDevice({ monitoringEnabled: false }))
      );

      const result = await useCase.execute(
        makeRequest({ monitoringEnabled: true })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.monitoringEnabled).toBe(true);
    });

    it('should disable monitoring when monitoringEnabled is false', async () => {
      repo.findById.mockResolvedValue(
        Result.ok(makePersistedDevice({ monitoringEnabled: true }))
      );

      const result = await useCase.execute(
        makeRequest({ monitoringEnabled: false })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.monitoringEnabled).toBe(false);
    });

    it('should not toggle monitoring when monitoringEnabled is undefined', async () => {
      repo.findById.mockResolvedValue(
        Result.ok(makePersistedDevice({ monitoringEnabled: false }))
      );

      const result = await useCase.execute(
        makeRequest({ monitoringEnabled: undefined })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.monitoringEnabled).toBe(false);
    });
  });

  // =========================================================================
  describe('executeImpl — MAC address uniqueness', () => {
    it('should fail when MAC address format is invalid', async () => {
      const result = await useCase.execute(
        makeRequest({ macAddress: 'not-a-mac' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not-a-mac');
    });

    it('should fail when MAC is used by another device', async () => {
      repo.existsByMacAddress.mockResolvedValue(Result.ok(true));

      const result = await useCase.execute(
        makeRequest({ macAddress: 'BB:CC:DD:EE:FF:00' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already assigned');
    });

    it('should fail when existsByMacAddress returns a failure Result', async () => {
      repo.existsByMacAddress.mockResolvedValue(
        Result.fail('DB timeout')
      );

      const result = await useCase.execute(
        makeRequest({ macAddress: 'BB:CC:DD:EE:FF:00' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Failed to check MAC address uniqueness'
      );
    });

    it('should NOT call existsByMacAddress when MAC is the same as the device current MAC', async () => {
      // Device already has EXISTING_MAC — sending the same value skips the uniqueness check
      const result = await useCase.execute(
        makeRequest({ macAddress: EXISTING_MAC })
      );

      expect(result.isSuccess).toBe(true);
      expect(repo.existsByMacAddress).not.toHaveBeenCalled();
    });

    it('should call existsByMacAddress when MAC differs from the current device MAC', async () => {
      const newMac = 'BB:CC:DD:EE:FF:00';

      await useCase.execute(makeRequest({ macAddress: newMac }));

      expect(repo.existsByMacAddress).toHaveBeenCalledTimes(1);
      const calledWith = repo.existsByMacAddress.mock.calls[0][0];
      expect(calledWith).toBeInstanceOf(MACAddress);
      expect(calledWith.toString()).toBe(newMac);
    });

    it('should succeed when macAddress is null (clear MAC)', async () => {
      // Needs a serialNumber as fallback identifier — INVENTORY devices
      // must keep at least one of serialNumber/macAddress.
      repo.findById.mockResolvedValue(
        Result.ok(makePersistedDevice({ serialNumber: 'SN-001' }))
      );

      const result = await useCase.execute(
        makeRequest({ macAddress: null })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.macAddress).toBeNull();
    });

    it('should not call existsByMacAddress when macAddress is undefined', async () => {
      await useCase.execute(makeRequest({ macAddress: undefined }));

      expect(repo.existsByMacAddress).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — IP address uniqueness', () => {
    it('should fail when IP format is invalid', async () => {
      const result = await useCase.execute(
        makeRequest({ ipAddress: '999.999.999.999' })
      );

      expect(result.isFailure).toBe(true);
    });

    it('should fail when IP is used by another device', async () => {
      repo.existsByIpAddress.mockResolvedValue(Result.ok(true));

      const result = await useCase.execute(
        makeRequest({ ipAddress: '10.0.0.1' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already assigned');
    });

    it('should fail when existsByIpAddress returns a failure Result', async () => {
      repo.existsByIpAddress.mockResolvedValue(
        Result.fail('DB connection lost')
      );

      const result = await useCase.execute(
        makeRequest({ ipAddress: '10.0.0.1' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Failed to check IP address uniqueness'
      );
    });

    it('should NOT call existsByIpAddress when IP is the same as the device current IP', async () => {
      // Device already has EXISTING_IP — sending the same value skips the uniqueness check
      const result = await useCase.execute(
        makeRequest({ ipAddress: EXISTING_IP })
      );

      expect(result.isSuccess).toBe(true);
      expect(repo.existsByIpAddress).not.toHaveBeenCalled();
    });

    it('should succeed when ipAddress is null (clear IP)', async () => {
      const result = await useCase.execute(
        makeRequest({ ipAddress: null })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.ipAddress).toBeNull();
    });

    it('should not call existsByIpAddress when ipAddress is undefined', async () => {
      await useCase.execute(makeRequest({ ipAddress: undefined }));

      expect(repo.existsByIpAddress).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — updateDetails', () => {
    it('should succeed when name is provided', async () => {
      const result = await useCase.execute(
        makeRequest({ name: 'Updated-Router' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.name).toBe('Updated-Router');
    });

    it('should fail when installedDate is an invalid date string', async () => {
      const result = await useCase.execute(
        makeRequest({ installedDate: 'not-a-date' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid installedDate');
      expect(result.error).toContain('not-a-date');
    });

    it('should succeed when installedDate is null (clear)', async () => {
      const result = await useCase.execute(
        makeRequest({ installedDate: null })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.installedDate).toBeNull();
    });

    it('should succeed when installedDate is a valid ISO 8601 string', async () => {
      const result = await useCase.execute(
        makeRequest({ installedDate: '2024-01-15T00:00:00.000Z' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.installedDate).toBe(
        '2024-01-15T00:00:00.000Z'
      );
    });

    it('should not call updateDetails when no detail fields are provided', async () => {
      repo.findById.mockResolvedValue(
        Result.ok(makePersistedDevice({ locationId: VALID_LOCATION_ID }))
      );

      // Only status and monitoring fields — no detail fields → updateDetails never invoked.
      // We confirm via save being called (the device exists) but no error about details.
      const result = await useCase.execute(
        makeRequest({ status: 'ACTIVE', monitoringEnabled: true })
      );

      expect(result.isSuccess).toBe(true);
      expect(repo.save).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  describe('executeImpl — repository save', () => {
    it('should fail when save returns a failure Result', async () => {
      repo.save.mockResolvedValue(
        Result.fail('Unique constraint violated')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to persist device');
    });

    it('should call repo.save exactly once on success', async () => {
      await useCase.execute(makeRequest());

      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('should pass a Device instance to repo.save', async () => {
      await useCase.execute(makeRequest());

      const savedArg = repo.save.mock.calls[0][0];
      expect(savedArg).toBeInstanceOf(Device);
    });
  });

  // =========================================================================
  describe('executeImpl — happy path', () => {
    it('should return isSuccess true', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
    });

    it('should return a DeviceResponseDTO with the correct id', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value!.id).toBe(VALID_DEVICE_ID);
    });

    it('should return the updated name in the DTO when name was changed', async () => {
      const result = await useCase.execute(
        makeRequest({ name: 'New-Switch-02' })
      );

      expect(result.value!.name).toBe('New-Switch-02');
    });

    it('should return the updated status in the DTO when status was changed', async () => {
      const result = await useCase.execute(
        makeRequest({ status: 'DAMAGED' })
      );

      expect(result.value!.status).toBe('DAMAGED');
    });

    it('should return the updated ownerType (uppercase) when ownerType was changed', async () => {
      const result = await useCase.execute(
        makeRequest({ ownerType: 'client' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.ownerType).toBe('CLIENT');
    });

    it('should return the updated category in the DTO when category was changed', async () => {
      const result = await useCase.execute(
        makeRequest({ category: 'CPE' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.category).toBe('CPE');
    });

    it('should return null category in the DTO when category is cleared', async () => {
      const result = await useCase.execute(
        makeRequest({ category: null })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.category).toBeNull();
    });

    it('should preserve the existing MAC when macAddress is not provided', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value!.macAddress).toBe(EXISTING_MAC);
    });

    it('should preserve the existing IP when ipAddress is not provided', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value!.ipAddress).toBe(EXISTING_IP);
    });
  });
});
