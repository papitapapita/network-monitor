// Source: src/application/device-inventory/use-cases/UpdateDeviceModelUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { UpdateDeviceModelUseCase } from '../../../../src/application/device-inventory/use-cases/UpdateDeviceModelUseCase';
import { IDeviceModelRepository } from '../../../../src/domain/device-inventory/repository/IDeviceModelRepository';
import { IVendorRepository } from '../../../../src/domain/device-inventory/repository/IVendorRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { DeviceModel } from '../../../../src/domain/device-inventory/aggregates/DeviceModel';
import { Vendor } from '../../../../src/domain/device-inventory/aggregates/Vendor';
import { DeviceModelId, VendorId } from '../../../../src/domain/shared/ids';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VENDOR_UUID = '550e8400-e29b-41d4-a716-446655440001';
const OTHER_VENDOR_UUID = '550e8400-e29b-41d4-a716-446655440002';
const NOW = new Date('2024-01-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeVendor(overrides: { name?: string; slug?: string } = {}): Vendor {
  return Vendor.reconstitute(VendorId.parse(VENDOR_UUID).value!, {
    name: overrides.name ?? 'Mikrotik',
    slug: overrides.slug ?? 'mikrotik',
    description: null,
    createdAt: NOW,
    updatedAt: NOW
  });
}

function makeOtherVendor(): Vendor {
  return Vendor.reconstitute(VendorId.parse(OTHER_VENDOR_UUID).value!, {
    name: 'Ubiquiti',
    slug: 'ubiquiti',
    description: null,
    createdAt: NOW,
    updatedAt: NOW
  });
}

function makeDeviceModel(): DeviceModel {
  return DeviceModel.reconstitute(DeviceModelId.parse(VALID_UUID).value!, {
    vendorId: VendorId.parse(VENDOR_UUID).value!,
    vendorName: 'Mikrotik',
    vendorSlug: 'mikrotik',
    model: 'RB760iGS',
    deviceType: 'ROUTER',
    isWireless: false,
    createdAt: NOW,
    updatedAt: NOW
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
    count: jest.fn()
  } as any;
}

function makeVendorRepo(): jest.Mocked<IVendorRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findBySlug: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    existsBySlug: jest.fn(),
    count: jest.fn()
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

describe('UpdateDeviceModelUseCase', () => {
  let deviceModelRepo: jest.Mocked<IDeviceModelRepository>;
  let vendorRepo: jest.Mocked<IVendorRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: UpdateDeviceModelUseCase;

  beforeEach(() => {
    deviceModelRepo = makeDeviceModelRepo();
    vendorRepo = makeVendorRepo();
    logger = makeLogger();
    useCase = new UpdateDeviceModelUseCase(deviceModelRepo, vendorRepo, logger);

    (deviceModelRepo.findById as any).mockResolvedValue(Result.ok(makeDeviceModel()));
    (vendorRepo.findById as any).mockResolvedValue(Result.ok(makeVendor()));
    (deviceModelRepo.save as any).mockImplementation(async (m: DeviceModel) => Result.ok(m));
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
      expect(deviceModelRepo.save).not.toHaveBeenCalled();
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
  describe('executeImpl — device model lookup', () => {
    it('should fail when device model is not found', async () => {
      (deviceModelRepo.findById as any).mockResolvedValue(Result.ok(null));

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
  });

  // =========================================================================
  describe('executeImpl — vendor change', () => {
    it('should fail when vendorId is not a valid UUID', async () => {
      const result = await useCase.execute({ id: VALID_UUID, vendorId: 'bad-uuid' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid vendor ID');
    });

    it('should fail when the new vendor is not found', async () => {
      (vendorRepo.findById as any).mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({
        id: VALID_UUID,
        vendorId: OTHER_VENDOR_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Vendor not found');
      expect(result.error).toContain(OTHER_VENDOR_UUID);
    });

    it('should propagate repository failure from vendorRepository.findById', async () => {
      (vendorRepo.findById as any).mockResolvedValue(Result.fail('Vendor DB error'));

      const result = await useCase.execute({
        id: VALID_UUID,
        vendorId: OTHER_VENDOR_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Vendor DB error');
    });

    it('should update vendorName and vendorSlug in the returned DTO when vendor changes', async () => {
      (vendorRepo.findById as any).mockResolvedValue(Result.ok(makeOtherVendor()));

      const result = await useCase.execute({
        id: VALID_UUID,
        vendorId: OTHER_VENDOR_UUID
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value!.vendorName).toBe('Ubiquiti');
      expect(result.value!.vendorSlug).toBe('ubiquiti');
    });

    it('should not call vendorRepository when vendorId is undefined', async () => {
      await useCase.execute({ id: VALID_UUID });

      expect(vendorRepo.findById).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — model update', () => {
    it('should fail when the new model is an empty string', async () => {
      const result = await useCase.execute({ id: VALID_UUID, model: '' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('empty');
    });

    it('should fail when the new model exceeds 150 characters', async () => {
      const longModel = 'A'.repeat(151);

      const result = await useCase.execute({ id: VALID_UUID, model: longModel });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('150');
    });

    it('should update the model in the returned DTO on the happy path', async () => {
      const result = await useCase.execute({
        id: VALID_UUID,
        model: 'CCR2004-16G-2S+'
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value!.model).toBe('CCR2004-16G-2S+');
    });

    it('should not call save when model update fails', async () => {
      await useCase.execute({ id: VALID_UUID, model: '' });

      expect(deviceModelRepo.save).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — deviceType update', () => {
    it('should update the deviceType in the returned DTO on the happy path', async () => {
      const result = await useCase.execute({
        id: VALID_UUID,
        deviceType: 'SWITCH'
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value!.deviceType).toBe('SWITCH');
    });
  });

  // =========================================================================
  describe('executeImpl — no-op update', () => {
    it('should save successfully when no optional fields are provided', async () => {
      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isSuccess).toBe(true);
      expect(deviceModelRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should preserve original model value when model is not provided', async () => {
      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.value!.model).toBe('RB760iGS');
    });

    it('should preserve original deviceType value when deviceType is not provided', async () => {
      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.value!.deviceType).toBe('ROUTER');
    });
  });

  // =========================================================================
  describe('executeImpl — repository save', () => {
    it('should fail with "Failed to persist device model" when save returns a failure', async () => {
      (deviceModelRepo.save as any).mockResolvedValue(
        Result.fail('Unique constraint violated')
      );

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to persist device model');
      expect(result.error).toContain('Unique constraint violated');
    });

    it('should call save exactly once on success', async () => {
      await useCase.execute({ id: VALID_UUID });

      expect(deviceModelRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should pass a DeviceModel instance to save', async () => {
      await useCase.execute({ id: VALID_UUID });

      const savedArg = (deviceModelRepo.save as any).mock.calls[0][0];
      expect(savedArg).toBeInstanceOf(DeviceModel);
    });
  });

  // =========================================================================
  describe('executeImpl — happy path', () => {
    it('should return isSuccess true', async () => {
      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isSuccess).toBe(true);
    });

    it('should return a DTO with the correct id', async () => {
      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.value!.id).toBe(VALID_UUID);
    });

    it('should return a DTO reflecting all three updated fields when all are provided', async () => {
      (vendorRepo.findById as any).mockResolvedValue(Result.ok(makeOtherVendor()));

      const result = await useCase.execute({
        id: VALID_UUID,
        vendorId: OTHER_VENDOR_UUID,
        model: 'CCR2004-16G-2S+',
        deviceType: 'SWITCH'
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value!.vendorName).toBe('Ubiquiti');
      expect(result.value!.model).toBe('CCR2004-16G-2S+');
      expect(result.value!.deviceType).toBe('SWITCH');
    });
  });
});
