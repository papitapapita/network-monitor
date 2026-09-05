// Source: src/application/device-inventory/use-cases/DeleteDeviceModelUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { DeleteDeviceModelUseCase } from '../../../../src/application/device-inventory/use-cases/DeleteDeviceModelUseCase';
import { IDeviceModelRepository } from '../../../../src/domain/device-inventory/repository/IDeviceModelRepository';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository/IDeviceRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { DeviceModel } from '../../../../src/domain/device-inventory/aggregates/DeviceModel';
import { Device } from '../../../../src/domain/device-inventory/aggregates/Device';
import {
  DeviceModelId,
  VendorId,
  DeviceId
} from '../../../../src/domain/shared/ids';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  DeviceName,
  DeviceStatus,
  DeviceType
} from '../../../../src/domain/device-inventory/value-objects';
import { DeviceOwnerType } from '../../../../src/domain/device-inventory/enums';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VENDOR_UUID = '550e8400-e29b-41d4-a716-446655440001';
const DEVICE_UUID_1 = '550e8400-e29b-41d4-a716-446655440002';
const DEVICE_UUID_2 = '550e8400-e29b-41d4-a716-446655440003';
const DEVICE_UUID_3 = '550e8400-e29b-41d4-a716-446655440004';
const NOW = new Date('2024-01-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeDeviceModel(): DeviceModel {
  return DeviceModel.reconstitute(
    DeviceModelId.parse(VALID_UUID).value!,
    {
      vendorId: VendorId.parse(VENDOR_UUID).value!,
      vendorName: 'Mikrotik',
      vendorSlug: 'mikrotik',
      model: 'RB760iGS',
      deviceType: DeviceType.reconstitute(DeviceType.ROUTER),
      isWireless: false,
      imageUrl: null,
      createdAt: NOW,
      updatedAt: NOW
    }
  );
}

function makeDevice(
  deviceUuid: string,
  deletedAt: Date | null = null
): Device {
  const id = DeviceId.parse(deviceUuid).value!;
  const modelId = DeviceModelId.parse(VALID_UUID).value!;
  const status = DeviceStatus.reconstitute(DeviceStatus.ACTIVE);
  const name = DeviceName.reconstitute('Router-01');

  return Device.reconstitute(id, {
    deviceModelId: modelId,
    locationId: null,
    status,
    category: null,
    ownerType: DeviceOwnerType.COMPANY,
    name,
    serialNumber: null,
    macAddress: null,
    ipAddress: null,
    description: null,
    installedDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    monitoringEnabled: false,
    deletedAt
  });
}

function makeDeviceModelRepo(): jest.Mocked<IDeviceModelRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findByVendor: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    existsByVendorAndModel: jest.fn(),
    findByVendorAndModel: jest.fn(),
    count: jest.fn()
  } as any;
}

function makeDeviceRepo(): jest.Mocked<IDeviceRepository> {
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
  } as any;
}

function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis() as any,
    setLevel: jest.fn()
  };
}

// ---------------------------------------------------------------------------

describe('DeleteDeviceModelUseCase', () => {
  let deviceModelRepo: jest.Mocked<IDeviceModelRepository>;
  let deviceRepo: jest.Mocked<IDeviceRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: DeleteDeviceModelUseCase;

  beforeEach(() => {
    deviceModelRepo = makeDeviceModelRepo();
    deviceRepo = makeDeviceRepo();
    logger = makeLogger();
    useCase = new DeleteDeviceModelUseCase(
      deviceModelRepo,
      deviceRepo,
      logger
    );

    (deviceModelRepo.findById as any).mockResolvedValue(
      Result.ok(makeDeviceModel())
    );
    (deviceRepo.findByDeviceModel as any).mockResolvedValue(
      Result.ok([])
    );
    (deviceRepo.findByFilters as any).mockResolvedValue(
      Result.ok([])
    );
    (deviceRepo.delete as any).mockResolvedValue(
      Result.ok(undefined)
    );
    (deviceModelRepo.delete as any).mockResolvedValue(
      Result.ok(undefined)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('beforeExecute — required field validation', () => {
    it('should fail when id is an empty string', async () => {
      const result = await useCase.execute({ id: '' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device model ID is required');
    });

    it('should fail when id is whitespace only', async () => {
      const result = await useCase.execute({ id: '   ' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device model ID is required');
    });

    it('should not call any repository when beforeExecute fails', async () => {
      await useCase.execute({ id: '' });

      expect(deviceModelRepo.findById).not.toHaveBeenCalled();
      expect(deviceRepo.findByDeviceModel).not.toHaveBeenCalled();
      expect(deviceModelRepo.delete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — ID parsing', () => {
    it('should fail when id is not a valid UUID', async () => {
      const result = await useCase.execute({ id: 'not-a-uuid' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device model ID');
    });

    it('should not call findById when the UUID is invalid', async () => {
      await useCase.execute({ id: 'not-a-uuid' });

      expect(deviceModelRepo.findById).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('[DEV-029] executeImpl — device model lookup', () => {
    it('should fail when device model is not found', async () => {
      (deviceModelRepo.findById as any).mockResolvedValue(
        Result.ok(null)
      );

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device model not found');
      expect(result.error).toContain(VALID_UUID);
    });

    it('should propagate repository failure from findById', async () => {
      (deviceModelRepo.findById as any).mockResolvedValue(
        Result.fail('DB connection lost')
      );

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB connection lost');
    });

    it('should not call findByDeviceModel when device model is not found', async () => {
      (deviceModelRepo.findById as any).mockResolvedValue(
        Result.ok(null)
      );

      await useCase.execute({ id: VALID_UUID });

      expect(deviceRepo.findByDeviceModel).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('[DEV-026] executeImpl — associated devices guard', () => {
    it('should fail when 1 device is associated with this model', async () => {
      (deviceRepo.findByDeviceModel as any).mockResolvedValue(
        Result.ok([makeDevice(DEVICE_UUID_1)])
      );

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Cannot delete device model');
      expect(result.error).toContain('1 device(s)');
    });

    it('should fail when 3 devices are associated and message contains "3 device(s)"', async () => {
      (deviceRepo.findByDeviceModel as any).mockResolvedValue(
        Result.ok([
          makeDevice(DEVICE_UUID_1),
          makeDevice(DEVICE_UUID_2),
          makeDevice(DEVICE_UUID_3)
        ])
      );

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('3 device(s)');
    });

    it('should include reassignment guidance in the error message when devices exist', async () => {
      (deviceRepo.findByDeviceModel as any).mockResolvedValue(
        Result.ok([makeDevice(DEVICE_UUID_1)])
      );

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.error).toContain('Reassign or remove');
    });

    it('should propagate repository failure from findByDeviceModel', async () => {
      (deviceRepo.findByDeviceModel as any).mockResolvedValue(
        Result.fail('Device DB timeout')
      );

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device DB timeout');
    });

    it('should not call delete when associated devices exist', async () => {
      (deviceRepo.findByDeviceModel as any).mockResolvedValue(
        Result.ok([makeDevice(DEVICE_UUID_1)])
      );

      await useCase.execute({ id: VALID_UUID });

      expect(deviceModelRepo.delete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('[DEV-030] executeImpl — devices in the recycle bin', () => {
    function binHolds(...devices: Device[]): void {
      (deviceRepo.findByFilters as any).mockResolvedValue(
        Result.ok(devices)
      );
    }

    it('should ask the bin only for tombstones on this model', async () => {
      await useCase.execute({ id: VALID_UUID });

      const filters = (deviceRepo.findByFilters as any).mock
        .calls[0][0];
      expect(filters.deleted).toBe('only');
      expect(filters.deviceModelId.toString()).toBe(VALID_UUID);
    });

    it('should refuse without confirmation and name the count', async () => {
      binHolds(makeDevice(DEVICE_UUID_1, NOW));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Cannot delete device model');
      expect(result.error).toContain(
        '1 device(s) in the recycle bin'
      );
      expect(result.error).toContain('purgeBinnedDevices=true');
    });

    it('should leave both the devices and the model alone when refused', async () => {
      binHolds(makeDevice(DEVICE_UUID_1, NOW));

      await useCase.execute({ id: VALID_UUID });

      expect(deviceRepo.delete).not.toHaveBeenCalled();
      expect(deviceModelRepo.delete).not.toHaveBeenCalled();
    });

    it('should refuse when purgeBinnedDevices is explicitly false', async () => {
      binHolds(makeDevice(DEVICE_UUID_1, NOW));

      const result = await useCase.execute({
        id: VALID_UUID,
        purgeBinnedDevices: false
      });

      expect(result.isFailure).toBe(true);
    });

    it('should purge every binned device once confirmed, then delete the model', async () => {
      binHolds(
        makeDevice(DEVICE_UUID_1, NOW),
        makeDevice(DEVICE_UUID_2, NOW)
      );

      const result = await useCase.execute({
        id: VALID_UUID,
        purgeBinnedDevices: true
      });

      expect(result.isSuccess).toBe(true);
      expect(deviceRepo.delete).toHaveBeenCalledTimes(2);
      expect(
        (deviceRepo.delete as any).mock.calls.map((c: any[]) =>
          c[0].toString()
        )
      ).toEqual([DEVICE_UUID_1, DEVICE_UUID_2]);
      expect(deviceModelRepo.delete).toHaveBeenCalledTimes(1);
    });

    // Half a purge would leave the model delete to fail on the FK anyway, so
    // stopping is what keeps the reported error the real one.
    it('should stop and report when a purge fails, without deleting the model', async () => {
      binHolds(
        makeDevice(DEVICE_UUID_1, NOW),
        makeDevice(DEVICE_UUID_2, NOW)
      );
      (deviceRepo.delete as any).mockResolvedValue(
        Result.fail('Row is referenced elsewhere')
      );

      const result = await useCase.execute({
        id: VALID_UUID,
        purgeBinnedDevices: true
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Row is referenced elsewhere');
      expect(deviceRepo.delete).toHaveBeenCalledTimes(1);
      expect(deviceModelRepo.delete).not.toHaveBeenCalled();
    });

    it('should propagate a failure loading the bin', async () => {
      (deviceRepo.findByFilters as any).mockResolvedValue(
        Result.fail('Device DB timeout')
      );

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device DB timeout');
      expect(deviceModelRepo.delete).not.toHaveBeenCalled();
    });

    // DEV-026 comes first: a live device is not something a confirmation can
    // wave through.
    it('should still refuse a live device even with confirmation', async () => {
      (deviceRepo.findByDeviceModel as any).mockResolvedValue(
        Result.ok([makeDevice(DEVICE_UUID_1)])
      );

      const result = await useCase.execute({
        id: VALID_UUID,
        purgeBinnedDevices: true
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Reassign or remove');
      expect(deviceRepo.delete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — delete operation', () => {
    it('should call delete exactly once with the correct DeviceModelId', async () => {
      await useCase.execute({ id: VALID_UUID });

      expect(deviceModelRepo.delete).toHaveBeenCalledTimes(1);
      const calledWith = (deviceModelRepo.delete as any).mock
        .calls[0][0];
      expect(calledWith).toBeInstanceOf(DeviceModelId);
      expect(calledWith.toString()).toBe(VALID_UUID);
    });

    it('should propagate repository failure from delete', async () => {
      (deviceModelRepo.delete as any).mockResolvedValue(
        Result.fail('Foreign key constraint violated')
      );

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Foreign key constraint violated'
      );
    });

    it('should not call delete when findByDeviceModel returns a failure', async () => {
      (deviceRepo.findByDeviceModel as any).mockResolvedValue(
        Result.fail('DB error')
      );

      await useCase.execute({ id: VALID_UUID });

      expect(deviceModelRepo.delete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — happy path', () => {
    it('should return isSuccess true', async () => {
      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isSuccess).toBe(true);
    });

    it('should return Result.ok(undefined)', async () => {
      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeUndefined();
    });
  });
});
