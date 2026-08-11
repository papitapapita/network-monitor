// Source: src/application/device-inventory/use-cases/DeleteVendorUseCase.ts

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { DeleteVendorUseCase } from '../../../../src/application/device-inventory/use-cases/DeleteVendorUseCase';
import { IVendorRepository } from '../../../../src/domain/device-inventory/repository/IVendorRepository';
import { IDeviceModelRepository } from '../../../../src/domain/device-inventory/repository/IDeviceModelRepository';
import { Vendor } from '../../../../src/domain/device-inventory/aggregates/Vendor';
import { DeviceModel } from '../../../../src/domain/device-inventory/aggregates/DeviceModel';
import { VendorId } from '../../../../src/domain/shared/ids/VendorId';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NOW = new Date('2024-01-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeLogger(): jest.Mocked<ILogger> {
  const child: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn(),
    setLevel: jest.fn()
  };
  child.child.mockReturnValue(child);
  return child;
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
  };
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
  };
}

function makeVendor(
  overrides: Partial<{ id: string; name: string; slug: string; description: string | null }> = {}
): Vendor {
  return Vendor.reconstitute(
    VendorId.parse(overrides.id ?? VALID_UUID).value!,
    {
      name: overrides.name ?? 'Mikrotik',
      slug: overrides.slug ?? 'mikrotik',
      description: overrides.description ?? null,
      createdAt: NOW,
      updatedAt: NOW
    }
  );
}

// ---------------------------------------------------------------------------

describe('DeleteVendorUseCase', () => {
  let vendorRepo: jest.Mocked<IVendorRepository>;
  let deviceModelRepo: jest.Mocked<IDeviceModelRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: DeleteVendorUseCase;

  beforeEach(() => {
    vendorRepo = makeVendorRepo();
    deviceModelRepo = makeDeviceModelRepo();
    logger = makeLogger();
    useCase = new DeleteVendorUseCase(vendorRepo, deviceModelRepo, logger);

    (vendorRepo.findById as any).mockResolvedValue(Result.ok(makeVendor()));
    (deviceModelRepo.findByVendor as any).mockResolvedValue(Result.ok([]));
    (vendorRepo.delete as any).mockResolvedValue(Result.ok(undefined));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('beforeExecute — required field validation', () => {
    it('should fail when id is an empty string', async () => {
      const result = await useCase.execute({ id: '' });

      expect(result.isFailure).toBe(true);
    });

    it('should return an error mentioning "ID" when id is empty', async () => {
      const result = await useCase.execute({ id: '' });

      expect(result.error).toContain('ID');
    });

    it('should not call findById when beforeExecute fails', async () => {
      await useCase.execute({ id: '' });

      expect(vendorRepo.findById).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — ID parsing', () => {
    it('should fail when id is not a valid UUID', async () => {
      const result = await useCase.execute({ id: 'not-a-uuid' });

      expect(result.isFailure).toBe(true);
    });

    it('should include "Invalid vendor ID" in the error for a malformed UUID', async () => {
      const result = await useCase.execute({ id: 'not-a-uuid' });

      expect(result.error).toContain('Invalid vendor ID');
    });
  });

  // =========================================================================
  describe('[DEV-008] executeImpl — vendor lookup', () => {
    it('should fail when findById returns null', async () => {
      (vendorRepo.findById as any).mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
    });

    it('should include "Vendor not found" in the error when vendor does not exist', async () => {
      (vendorRepo.findById as any).mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.error).toContain('Vendor not found');
    });

    it('should propagate a findById repository failure', async () => {
      (vendorRepo.findById as any).mockResolvedValue(Result.fail('Timeout'));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
    });
  });

  // =========================================================================
  describe('[DEV-005] executeImpl — device model guard', () => {
    it('should fail when vendor has associated device models', async () => {
      const fakeModel = {} as DeviceModel;
      (deviceModelRepo.findByVendor as any).mockResolvedValue(Result.ok([fakeModel]));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
    });

    it('should include "Cannot delete vendor" in the error when device models exist', async () => {
      const fakeModel = {} as DeviceModel;
      (deviceModelRepo.findByVendor as any).mockResolvedValue(Result.ok([fakeModel]));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.error).toContain('Cannot delete vendor');
    });

    it('should include the device model count in the error message', async () => {
      const fakeModels = [{} as DeviceModel, {} as DeviceModel];
      (deviceModelRepo.findByVendor as any).mockResolvedValue(Result.ok(fakeModels));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.error).toContain('2');
    });

    it('should propagate a findByVendor repository failure', async () => {
      (deviceModelRepo.findByVendor as any).mockResolvedValue(Result.fail('DB error'));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
    });

    it('should not call delete when device models exist', async () => {
      const fakeModel = {} as DeviceModel;
      (deviceModelRepo.findByVendor as any).mockResolvedValue(Result.ok([fakeModel]));

      await useCase.execute({ id: VALID_UUID });

      expect(vendorRepo.delete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — delete operation', () => {
    it('should fail when repository delete returns a failure', async () => {
      (vendorRepo.delete as any).mockResolvedValue(Result.fail('FK constraint'));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
    });

    it('should carry the repository error message on delete failure', async () => {
      (vendorRepo.delete as any).mockResolvedValue(Result.fail('FK constraint'));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.error).toContain('FK constraint');
    });

    it('should call delete exactly once on the happy path', async () => {
      await useCase.execute({ id: VALID_UUID });

      expect(vendorRepo.delete).toHaveBeenCalledTimes(1);
    });

    it('should call delete with a VendorId whose toString matches the input', async () => {
      await useCase.execute({ id: VALID_UUID });

      const calledWith = (vendorRepo.delete as any).mock.calls[0][0];
      expect(calledWith).toBeInstanceOf(VendorId);
      expect(calledWith.toString()).toBe(VALID_UUID);
    });
  });

  // =========================================================================
  describe('executeImpl — happy path', () => {
    it('should return isSuccess true', async () => {
      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isSuccess).toBe(true);
    });

    it('should return value as undefined', async () => {
      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.value).toBeUndefined();
    });
  });
});
