// Source: src/application/device-inventory/use-cases/PurgeDeletedDevicesUseCase.ts

import { PurgeDeletedDevicesUseCase } from '../../../../src/application/device-inventory/use-cases/PurgeDeletedDevicesUseCase';
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

const VALID_DEVICE_MODEL = '550e8400-e29b-41d4-a716-446655440001';
const NOW = new Date('2026-08-01T00:00:00.000Z');

function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  } as unknown as jest.Mocked<ILogger>;
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

function makeDeletedDevice(): Device {
  return Device.reconstitute(DeviceId.create(), {
    deviceModelId: DeviceModelId.parse(VALID_DEVICE_MODEL).value,
    locationId: null,
    status: DeviceStatus.reconstitute(DeviceStatus.INVENTORY),
    category: null,
    ownerType: DeviceOwnerType.COMPANY,
    name: DeviceName.reconstitute('Retired-01'),
    serialNumber: null,
    macAddress: MACAddress.create('AA:BB:CC:DD:EE:FF').value,
    ipAddress: null,
    description: null,
    installedDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    monitoringEnabled: false,
    deletedAt: NOW,
    deletedBy: 'user-1'
  });
}

// ---------------------------------------------------------------------------

describe('[DEV-077] PurgeDeletedDevicesUseCase', () => {
  let repo: jest.Mocked<IDeviceRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: PurgeDeletedDevicesUseCase;

  beforeEach(() => {
    repo = makeRepo();
    logger = makeLogger();
    useCase = new PurgeDeletedDevicesUseCase(repo, logger);

    repo.findDeletedBefore.mockResolvedValue(Result.ok([]));
    repo.delete.mockResolvedValue(Result.ok(undefined));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('cutoff', () => {
    it('should look for devices deleted before now minus the grace period', async () => {
      const before = Date.now();

      await useCase.execute(7);

      const cutoff = repo.findDeletedBefore.mock.calls[0][0];
      const expected = before - 7 * 86_400_000;
      // Allow a small window for clock movement between the two reads.
      expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(
        1_000
      );
    });

    it('should propagate a lookup failure', async () => {
      repo.findDeletedBefore.mockResolvedValue(
        Result.fail('DB connection lost')
      );

      const result = await useCase.execute(7);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB connection lost');
    });
  });

  // =========================================================================
  describe('purging', () => {
    it('should hard-delete every device past its grace period', async () => {
      const devices = [
        makeDeletedDevice(),
        makeDeletedDevice(),
        makeDeletedDevice()
      ];
      repo.findDeletedBefore.mockResolvedValue(Result.ok(devices));

      const result = await useCase.execute(7);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(3);
      expect(repo.delete).toHaveBeenCalledTimes(3);
    });

    it('should return zero when nothing is due', async () => {
      const result = await useCase.execute(7);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(0);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    // No transaction wraps the loop, so one bad row must not strand the rest.
    it('should keep going when one delete fails', async () => {
      repo.findDeletedBefore.mockResolvedValue(
        Result.ok([
          makeDeletedDevice(),
          makeDeletedDevice(),
          makeDeletedDevice()
        ])
      );
      repo.delete
        .mockResolvedValueOnce(Result.ok(undefined))
        .mockResolvedValueOnce(Result.fail('FK violation'))
        .mockResolvedValueOnce(Result.ok(undefined));

      const result = await useCase.execute(7);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(2);
      expect(repo.delete).toHaveBeenCalledTimes(3);
    });

    it('should log the device that could not be purged', async () => {
      repo.findDeletedBefore.mockResolvedValue(
        Result.ok([makeDeletedDevice()])
      );
      repo.delete.mockResolvedValue(Result.fail('FK violation'));

      await useCase.execute(7);

      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });
});
