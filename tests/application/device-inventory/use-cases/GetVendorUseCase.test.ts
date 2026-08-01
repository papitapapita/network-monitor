// Source: src/application/device-inventory/use-cases/GetVendorUseCase.ts

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { GetVendorUseCase } from '../../../../src/application/device-inventory/use-cases/GetVendorUseCase';
import { IVendorRepository } from '../../../../src/domain/device-inventory/repository/IVendorRepository';
import { Vendor } from '../../../../src/domain/device-inventory/aggregates/Vendor';
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

function makeRepo(): jest.Mocked<IVendorRepository> {
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

describe('GetVendorUseCase', () => {
  let repo: jest.Mocked<IVendorRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: GetVendorUseCase;

  beforeEach(() => {
    repo = makeRepo();
    logger = makeLogger();
    useCase = new GetVendorUseCase(repo, logger);

    (repo.findById as any).mockResolvedValue(Result.ok(makeVendor()));
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

    it('should fail when id is whitespace only', async () => {
      const result = await useCase.execute({ id: '   ' });

      expect(result.isFailure).toBe(true);
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
  describe('executeImpl — repository lookup', () => {
    it('should fail when findById returns null (vendor not found)', async () => {
      (repo.findById as any).mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
    });

    it('should include "not found" in the error when vendor does not exist', async () => {
      (repo.findById as any).mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.error).toContain('not found');
    });

    it('should include the requested id in the not-found error', async () => {
      (repo.findById as any).mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.error).toContain(VALID_UUID);
    });

    it('should propagate a repository failure from findById', async () => {
      (repo.findById as any).mockResolvedValue(Result.fail('DB timeout'));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
    });

    it('should carry the repository error message through on findById failure', async () => {
      (repo.findById as any).mockResolvedValue(Result.fail('DB timeout'));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.error).toContain('DB timeout');
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

    it('should return a DTO with the correct name', async () => {
      (repo.findById as any).mockResolvedValue(Result.ok(makeVendor({ name: 'Ubiquiti' })));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.value!.name).toBe('Ubiquiti');
    });

    it('should return a DTO with the correct slug', async () => {
      (repo.findById as any).mockResolvedValue(Result.ok(makeVendor({ slug: 'ubiquiti' })));

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.value!.slug).toBe('ubiquiti');
    });

    it('should return a DTO with description null when vendor has no description', async () => {
      (repo.findById as any).mockResolvedValue(
        Result.ok(makeVendor({ description: null }))
      );

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.value!.description).toBeNull();
    });

    it('should return a DTO with the vendor description when present', async () => {
      (repo.findById as any).mockResolvedValue(
        Result.ok(makeVendor({ description: 'A networking vendor' }))
      );

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.value!.description).toBe('A networking vendor');
    });

    it('should return createdAt as an ISO 8601 string', async () => {
      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.value!.createdAt).toBe(NOW.toISOString());
    });
  });
});
