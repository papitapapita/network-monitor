// Source: src/application/device-inventory/use-cases/CreateDeviceModelUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { CreateDeviceModelUseCase } from '../../../../src/application/device-inventory/use-cases/CreateDeviceModelUseCase';
import { IDeviceModelRepository } from '../../../../src/domain/device-inventory/repository/IDeviceModelRepository';
import { IVendorRepository } from '../../../../src/domain/device-inventory/repository/IVendorRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { DeviceModel } from '../../../../src/domain/device-inventory/aggregates/DeviceModel';
import { Vendor } from '../../../../src/domain/device-inventory/aggregates/Vendor';
import { VendorId } from '../../../../src/domain/shared/ids';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VENDOR_UUID = '550e8400-e29b-41d4-a716-446655440001';
const NOW = new Date('2024-01-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeVendor(): Vendor {
  return Vendor.reconstitute(VendorId.parse(VENDOR_UUID).value!, {
    name: 'Mikrotik',
    slug: 'mikrotik',
    description: null,
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
    findByName: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    existsBySlug: jest.fn(),
    existsByName: jest.fn(),
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

describe('CreateDeviceModelUseCase', () => {
  let deviceModelRepo: jest.Mocked<IDeviceModelRepository>;
  let vendorRepo: jest.Mocked<IVendorRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: CreateDeviceModelUseCase;

  beforeEach(() => {
    deviceModelRepo = makeDeviceModelRepo();
    vendorRepo = makeVendorRepo();
    logger = makeLogger();
    useCase = new CreateDeviceModelUseCase(
      deviceModelRepo,
      vendorRepo,
      logger
    );

    (vendorRepo.findById as any).mockResolvedValue(
      Result.ok(makeVendor())
    );
    (deviceModelRepo.existsByVendorAndModel as any).mockResolvedValue(
      Result.ok(false)
    );
    (deviceModelRepo.save as any).mockImplementation(
      async (m: DeviceModel) => Result.ok(m)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('[DEV-020] [DEV-024] beforeExecute — required field validation', () => {
    it('should fail when vendorId is an empty string', async () => {
      const result = await useCase.execute({
        vendorId: '',
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Vendor ID is required');
    });

    it('should fail when vendorId is whitespace only', async () => {
      const result = await useCase.execute({
        vendorId: '   ',
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Vendor ID is required');
    });

    it('should fail when model is an empty string', async () => {
      const result = await useCase.execute({
        vendorId: VENDOR_UUID,
        model: '',
        deviceType: 'ROUTER'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Model name is required');
    });

    it('should fail when model is whitespace only', async () => {
      const result = await useCase.execute({
        vendorId: VENDOR_UUID,
        model: '   ',
        deviceType: 'ROUTER'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Model name is required');
    });

    it('should fail when deviceType is an empty string', async () => {
      const result = await useCase.execute({
        vendorId: VENDOR_UUID,
        model: 'RB760iGS',
        deviceType: ''
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device type is required');
    });

    it('should fail when deviceType is whitespace only', async () => {
      const result = await useCase.execute({
        vendorId: VENDOR_UUID,
        model: 'RB760iGS',
        deviceType: '   '
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device type is required');
    });

    it('should not call any repository method when beforeExecute fails', async () => {
      await useCase.execute({
        vendorId: '',
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(vendorRepo.findById).not.toHaveBeenCalled();
      expect(
        deviceModelRepo.existsByVendorAndModel
      ).not.toHaveBeenCalled();
      expect(deviceModelRepo.save).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — vendor ID parsing', () => {
    it('should fail when vendorId is not a valid UUID', async () => {
      const result = await useCase.execute({
        vendorId: 'not-a-uuid',
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid vendor ID');
    });

    it('should not call vendorRepository when the vendorId UUID is invalid', async () => {
      await useCase.execute({
        vendorId: 'not-a-uuid',
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(vendorRepo.findById).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('[DEV-021] executeImpl — vendor lookup', () => {
    it('should fail when vendor is not found', async () => {
      (vendorRepo.findById as any).mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({
        vendorId: VENDOR_UUID,
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Vendor not found');
      expect(result.error).toContain(VENDOR_UUID);
    });

    it('should propagate repository failure from vendorRepository.findById', async () => {
      (vendorRepo.findById as any).mockResolvedValue(
        Result.fail('DB connection lost')
      );

      const result = await useCase.execute({
        vendorId: VENDOR_UUID,
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB connection lost');
    });
  });

  // =========================================================================
  describe('[DEV-022] executeImpl — model uniqueness check', () => {
    it('should fail when the model already exists for this vendor', async () => {
      (
        deviceModelRepo.existsByVendorAndModel as any
      ).mockResolvedValue(Result.ok(true));

      const result = await useCase.execute({
        vendorId: VENDOR_UUID,
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already exists');
      expect(result.error).toContain('RB760iGS');
    });

    it('should propagate repository failure from existsByVendorAndModel', async () => {
      (
        deviceModelRepo.existsByVendorAndModel as any
      ).mockResolvedValue(Result.fail('DB timeout'));

      const result = await useCase.execute({
        vendorId: VENDOR_UUID,
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB timeout');
    });

    it('should not call save when the model already exists', async () => {
      (
        deviceModelRepo.existsByVendorAndModel as any
      ).mockResolvedValue(Result.ok(true));

      await useCase.execute({
        vendorId: VENDOR_UUID,
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(deviceModelRepo.save).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — repository save', () => {
    it('should fail with "Failed to persist device model" when save returns a failure', async () => {
      (deviceModelRepo.save as any).mockResolvedValue(
        Result.fail('Unique constraint violated')
      );

      const result = await useCase.execute({
        vendorId: VENDOR_UUID,
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Failed to persist device model'
      );
      expect(result.error).toContain('Unique constraint violated');
    });

    it('should call save exactly once on the happy path', async () => {
      await useCase.execute({
        vendorId: VENDOR_UUID,
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(deviceModelRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should pass a DeviceModel instance to save', async () => {
      await useCase.execute({
        vendorId: VENDOR_UUID,
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      const savedArg = (deviceModelRepo.save as any).mock.calls[0][0];
      expect(savedArg).toBeInstanceOf(DeviceModel);
    });
  });

  // =========================================================================
  describe('executeImpl — happy path', () => {
    it('should return isSuccess true', async () => {
      const result = await useCase.execute({
        vendorId: VENDOR_UUID,
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(result.isSuccess).toBe(true);
    });

    it('should return a DTO with vendorName from the vendor aggregate', async () => {
      const result = await useCase.execute({
        vendorId: VENDOR_UUID,
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(result.value!.vendorName).toBe('Mikrotik');
    });

    it('should return a DTO with vendorSlug from the vendor aggregate', async () => {
      const result = await useCase.execute({
        vendorId: VENDOR_UUID,
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(result.value!.vendorSlug).toBe('mikrotik');
    });

    it('should return a DTO with the correct model', async () => {
      const result = await useCase.execute({
        vendorId: VENDOR_UUID,
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(result.value!.model).toBe('RB760iGS');
    });

    it('should return a DTO with the correct deviceType', async () => {
      const result = await useCase.execute({
        vendorId: VENDOR_UUID,
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(result.value!.deviceType).toBe('ROUTER');
    });

    it('should return a DTO with the vendorId', async () => {
      const result = await useCase.execute({
        vendorId: VENDOR_UUID,
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(result.value!.vendorId).toBe(VENDOR_UUID);
    });

    it('should return a DTO with an id string', async () => {
      const result = await useCase.execute({
        vendorId: VENDOR_UUID,
        model: 'RB760iGS',
        deviceType: 'ROUTER'
      });

      expect(typeof result.value!.id).toBe('string');
      expect(result.value!.id.length).toBeGreaterThan(0);
    });

    it('should trim leading and trailing whitespace from model before saving', async () => {
      await useCase.execute({
        vendorId: VENDOR_UUID,
        model: '  RB760iGS  ',
        deviceType: 'ROUTER'
      });

      const savedArg: DeviceModel = (deviceModelRepo.save as any).mock
        .calls[0][0];
      expect(savedArg.model).toBe('RB760iGS');
    });
  });
});
