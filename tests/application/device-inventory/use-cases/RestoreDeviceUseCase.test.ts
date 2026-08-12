// Source: src/application/device-inventory/use-cases/RestoreDeviceUseCase.ts

import { RestoreDeviceUseCase } from '../../../../src/application/device-inventory/use-cases/RestoreDeviceUseCase';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core';
import { Device } from '../../../../src/domain/device-inventory/aggregates';
import { MACAddress } from '../../../../src/domain/shared';
import {
  DeviceName,
  DeviceStatus
} from '../../../../src/domain/device-inventory/value-objects';
import { DeviceOwnerType } from '../../../../src/domain/device-inventory/enums';
import {
  DeviceId,
  DeviceModelId
} from '../../../../src/domain/shared/ids';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_DEVICE_MODEL = '550e8400-e29b-41d4-a716-446655440001';
const NOW = new Date('2026-08-01T00:00:00.000Z');

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
    findByFilters: jest.fn(),
    findByIdIncludingDeleted: jest.fn(),
    findDeletedBefore: jest.fn(),
    countByFilters: jest.fn()
  };
}

function makeDevice(deletedAt: Date | null): Device {
  return Device.reconstitute(DeviceId.parse(VALID_DEVICE_ID).value, {
    deviceModelId: DeviceModelId.parse(VALID_DEVICE_MODEL).value,
    locationId: null,
    status: DeviceStatus.reconstitute(DeviceStatus.INVENTORY),
    category: null,
    ownerType: DeviceOwnerType.COMPANY,
    name: DeviceName.reconstitute('Core-Router-01'),
    serialNumber: null,
    macAddress: MACAddress.create('AA:BB:CC:DD:EE:FF').value,
    ipAddress: null,
    description: null,
    installedDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    monitoringEnabled: false,
    deletedAt,
    deletedBy: deletedAt ? 'user-1' : null
  });
}

// ---------------------------------------------------------------------------

describe('RestoreDeviceUseCase', () => {
  let repo: jest.Mocked<IDeviceRepository>;
  let logger: ILogger;
  let useCase: RestoreDeviceUseCase;

  beforeEach(() => {
    repo = makeRepo();
    logger = makeLogger();
    useCase = new RestoreDeviceUseCase(repo, logger, 7);

    repo.findByIdIncludingDeleted.mockResolvedValue(
      Result.ok(makeDevice(new Date()))
    );
    repo.save.mockImplementation((device) =>
      Promise.resolve(Result.ok(device))
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('beforeExecute — validation', () => {
    it('should fail when id is an empty string', async () => {
      const result = await useCase.execute({ id: '' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should not look anything up when validation fails', async () => {
      await useCase.execute({ id: '   ' });

      expect(repo.findByIdIncludingDeleted).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — lookup', () => {
    it('should fail when id is not a valid UUID', async () => {
      const result = await useCase.execute({ id: 'not-a-uuid' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });

    // The whole point: findById hides tombstones, so restore must not use it.
    it('should read through the tombstone-aware finder', async () => {
      await useCase.execute({ id: VALID_DEVICE_ID });

      expect(repo.findByIdIncludingDeleted).toHaveBeenCalledTimes(1);
      expect(repo.findById).not.toHaveBeenCalled();
    });

    it('should fail when the device does not exist', async () => {
      repo.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(null)
      );

      const result = await useCase.execute({ id: VALID_DEVICE_ID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device not found');
    });

    it('should propagate a lookup failure', async () => {
      repo.findByIdIncludingDeleted.mockResolvedValue(
        Result.fail('DB connection lost')
      );

      const result = await useCase.execute({ id: VALID_DEVICE_ID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB connection lost');
    });
  });

  // =========================================================================
  describe('[DEV-074] executeImpl — grace period', () => {
    it('should restore a device deleted inside the grace period', async () => {
      const deletedAt = new Date(Date.now() - 2 * 86_400_000);
      repo.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(makeDevice(deletedAt))
      );

      const result = await useCase.execute({ id: VALID_DEVICE_ID });

      expect(result.isSuccess).toBe(true);
      expect(repo.save.mock.calls[0][0].isDeleted()).toBe(false);
    });

    it('should refuse a device whose grace period has expired', async () => {
      const deletedAt = new Date(Date.now() - 8 * 86_400_000);
      repo.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(makeDevice(deletedAt))
      );

      const result = await useCase.execute({ id: VALID_DEVICE_ID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('grace period expired');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should refuse a device that is not deleted', async () => {
      repo.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(makeDevice(null))
      );

      const result = await useCase.execute({ id: VALID_DEVICE_ID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not deleted');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should honour a configured grace period other than the default', async () => {
      const shortGrace = new RestoreDeviceUseCase(repo, logger, 1);
      repo.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(makeDevice(new Date(Date.now() - 2 * 86_400_000)))
      );

      const result = await shortGrace.execute({
        id: VALID_DEVICE_ID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('1-day grace period');
    });
  });

  // =========================================================================
  describe('executeImpl — happy path', () => {
    it('should return the restored device as a DTO', async () => {
      const result = await useCase.execute({ id: VALID_DEVICE_ID });

      expect(result.isSuccess).toBe(true);
      expect(result.value.id).toBe(VALID_DEVICE_ID);
      expect(result.value.deletedAt).toBeNull();
      expect(result.value.deletedBy).toBeNull();
    });

    it('should leave monitoring off', async () => {
      const result = await useCase.execute({ id: VALID_DEVICE_ID });

      expect(result.value.monitoringEnabled).toBe(false);
    });

    it('should propagate a save failure', async () => {
      repo.save.mockResolvedValue(Result.fail('Write conflict'));

      const result = await useCase.execute({ id: VALID_DEVICE_ID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Write conflict');
    });
  });
});
