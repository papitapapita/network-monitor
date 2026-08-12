// Source: src/application/device-inventory/use-cases/PermanentlyDeleteDeviceUseCase.ts

import { PermanentlyDeleteDeviceUseCase } from '../../../../src/application/device-inventory/use-cases/PermanentlyDeleteDeviceUseCase';
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

const VALID_DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_DEVICE_MODEL = '550e8400-e29b-41d4-a716-446655440001';
const NOW = new Date('2026-08-01T00:00:00.000Z');

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
    name: DeviceName.reconstitute('Binned Device'),
    serialNumber: null,
    macAddress: MACAddress.create('AA:BB:CC:DD:EE:FF').value,
    ipAddress: null,
    description: null,
    installedDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    monitoringEnabled: false,
    deletedAt
  });
}

// ---------------------------------------------------------------------------

describe('[DEV-085] PermanentlyDeleteDeviceUseCase', () => {
  let repo: jest.Mocked<IDeviceRepository>;
  let logger: ILogger;
  let useCase: PermanentlyDeleteDeviceUseCase;

  beforeEach(() => {
    repo = makeRepo();
    logger = makeLogger();
    useCase = new PermanentlyDeleteDeviceUseCase(repo, logger);

    repo.findByIdIncludingDeleted.mockResolvedValue(
      Result.ok(makeDevice(NOW))
    );
    repo.delete.mockResolvedValue(Result.ok(undefined));
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

    // The bin is the only thing this operates on, so it must read through the
    // tombstone-aware finder.
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
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('[DEV-085] the bin is the only way in', () => {
    it('should refuse a device that is not deleted', async () => {
      repo.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(makeDevice(null))
      );

      const result = await useCase.execute({ id: VALID_DEVICE_ID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'not in the recycle bin'
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('should remove a device that is in the bin', async () => {
      const result = await useCase.execute({ id: VALID_DEVICE_ID });

      expect(result.isSuccess).toBe(true);
      expect(repo.delete).toHaveBeenCalledTimes(1);
      expect(repo.delete.mock.calls[0][0].toString()).toBe(
        VALID_DEVICE_ID
      );
    });

    it('should propagate a delete failure', async () => {
      repo.delete.mockResolvedValue(
        Result.fail('Foreign key constraint violated')
      );

      const result = await useCase.execute({ id: VALID_DEVICE_ID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Foreign key constraint violated'
      );
    });
  });
});
