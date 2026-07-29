// Source: src/application/device-inventory/use-cases/UpdateVendorUseCase.ts

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { UpdateVendorUseCase } from '../../../../src/application/device-inventory/use-cases/UpdateVendorUseCase';
import { IVendorRepository } from '../../../../src/domain/device-inventory/repository/IVendorRepository';
import { Vendor } from '../../../../src/domain/device-inventory/aggregates/Vendor';
import { VendorId } from '../../../../src/domain/shared/ids/VendorId';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_UUID = '660e8400-e29b-41d4-a716-446655440001';
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

function makeRepo(): jest.Mocked<IVendorRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findBySlug: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    existsBySlug: jest.fn(),
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

describe('UpdateVendorUseCase', () => {
  let repo: jest.Mocked<IVendorRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: UpdateVendorUseCase;

  beforeEach(() => {
    repo = makeRepo();
    logger = makeLogger();
    useCase = new UpdateVendorUseCase(repo, logger);

    (repo.findById as any).mockResolvedValue(Result.ok(makeVendor()));
    (repo.findBySlug as any).mockResolvedValue(Result.ok(null));
    (repo.save as any).mockImplementation(async (v: Vendor) => Result.ok(v));
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

      expect(repo.findById).not.toHaveBeenCalled();
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
  describe('executeImpl — vendor lookup', () => {
    it('should fail when findById returns null', async () => {
      (repo.findById as any).mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
    });

    it('should include "Vendor not found" in the error when vendor does not exist', async () => {
      (repo.findById as any).mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.error).toContain('Vendor not found');
    });

    it('should propagate a repository failure from findById', async () => {
      (repo.findById as any).mockResolvedValue(Result.fail('Connection refused'));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
    });
  });

  // =========================================================================
  describe('[DEV-003] executeImpl — slug update', () => {
    it('should fail when the new slug is already taken by a different vendor', async () => {
      const otherVendor = makeVendor({ id: OTHER_UUID, slug: 'ubiquiti' });
      (repo.findBySlug as any).mockResolvedValue(Result.ok(otherVendor));

      const result = await useCase.execute({ id: VALID_UUID, slug: 'ubiquiti' });

      expect(result.isFailure).toBe(true);
    });

    it('should include "already exists" in the error when slug is taken by another vendor', async () => {
      const otherVendor = makeVendor({ id: OTHER_UUID, slug: 'ubiquiti' });
      (repo.findBySlug as any).mockResolvedValue(Result.ok(otherVendor));

      const result = await useCase.execute({ id: VALID_UUID, slug: 'ubiquiti' });

      expect(result.error).toContain('already exists');
    });

    it('should succeed when the slug belongs to the same vendor (no conflict)', async () => {
      const sameVendor = makeVendor({ id: VALID_UUID, slug: 'mikrotik' });
      (repo.findBySlug as any).mockResolvedValue(Result.ok(sameVendor));

      const result = await useCase.execute({ id: VALID_UUID, slug: 'mikrotik' });

      expect(result.isSuccess).toBe(true);
    });

    it('should succeed when slug is not taken by any vendor', async () => {
      (repo.findBySlug as any).mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({ id: VALID_UUID, slug: 'new-slug' });

      expect(result.isSuccess).toBe(true);
    });

    it('should propagate findBySlug repository failure', async () => {
      (repo.findBySlug as any).mockResolvedValue(Result.fail('DB error'));

      const result = await useCase.execute({ id: VALID_UUID, slug: 'ubiquiti' });

      expect(result.isFailure).toBe(true);
    });
  });

  // =========================================================================
  describe('executeImpl — name-only update', () => {
    it('should return isSuccess true when updating name only', async () => {
      const result = await useCase.execute({ id: VALID_UUID, name: 'MikroTik Updated' });

      expect(result.isSuccess).toBe(true);
    });

    it('should return a DTO with the updated name', async () => {
      const result = await useCase.execute({ id: VALID_UUID, name: 'MikroTik Updated' });

      expect(result.value!.name).toBe('MikroTik Updated');
    });

    it('should not call findBySlug when slug is not in the request', async () => {
      await useCase.execute({ id: VALID_UUID, name: 'MikroTik Updated' });

      expect(repo.findBySlug).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — save failure', () => {
    it('should fail when repository save returns a failure', async () => {
      (repo.save as any).mockResolvedValue(Result.fail('Write failed'));

      const result = await useCase.execute({ id: VALID_UUID, name: 'New Name' });

      expect(result.isFailure).toBe(true);
    });

    it('should include a descriptive message when save fails', async () => {
      (repo.save as any).mockResolvedValue(Result.fail('Write failed'));

      const result = await useCase.execute({ id: VALID_UUID, name: 'New Name' });

      expect(result.error).toContain('persist');
    });
  });

  // =========================================================================
  describe('executeImpl — happy path', () => {
    it('should call save exactly once on a successful update', async () => {
      await useCase.execute({ id: VALID_UUID, name: 'New Name' });

      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('should return the correct id in the response DTO', async () => {
      const result = await useCase.execute({ id: VALID_UUID, name: 'New Name' });

      expect(result.value!.id).toBe(VALID_UUID);
    });

    it('should return an updated slug in the DTO after slug update', async () => {
      const result = await useCase.execute({ id: VALID_UUID, slug: 'new-slug' });

      expect(result.value!.slug).toBe('new-slug');
    });
  });
});
