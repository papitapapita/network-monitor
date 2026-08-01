// Source: src/application/device-inventory/use-cases/ListVendorsUseCase.ts

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ListVendorsUseCase } from '../../../../src/application/device-inventory/use-cases/ListVendorsUseCase';
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

describe('ListVendorsUseCase', () => {
  let repo: jest.Mocked<IVendorRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: ListVendorsUseCase;

  beforeEach(() => {
    repo = makeRepo();
    logger = makeLogger();
    useCase = new ListVendorsUseCase(repo, logger);

    (repo.findAll as any).mockResolvedValue(Result.ok([makeVendor()]));
    (repo.count as any).mockResolvedValue(Result.ok(1));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('executeImpl — happy path', () => {
    it('should return isSuccess true', async () => {
      const result = await useCase.execute({});

      expect(result.isSuccess).toBe(true);
    });

    it('should return the correct total in the response', async () => {
      (repo.count as any).mockResolvedValue(Result.ok(42));

      const result = await useCase.execute({});

      expect(result.value!.total).toBe(42);
    });

    it('should return the vendors array in the response', async () => {
      const result = await useCase.execute({});

      expect(result.value!.vendors).toHaveLength(1);
    });

    it('should map vendor names through to the DTO list', async () => {
      (repo.findAll as any).mockResolvedValue(
        Result.ok([makeVendor({ name: 'Ubiquiti' })])
      );

      const result = await useCase.execute({});

      expect(result.value!.vendors[0].name).toBe('Ubiquiti');
    });
  });

  // =========================================================================
  describe('executeImpl — limit and offset behaviour', () => {
    it('should default limit to 20 when not provided', async () => {
      await useCase.execute({});

      expect(repo.findAll).toHaveBeenCalledWith(20, 0);
    });

    it('should cap limit at 100 when a value exceeding 100 is given', async () => {
      await useCase.execute({ limit: 999 });

      expect(repo.findAll).toHaveBeenCalledWith(100, expect.any(Number));
    });

    it('should pass the provided limit to findAll when within bounds', async () => {
      await useCase.execute({ limit: 50 });

      expect(repo.findAll).toHaveBeenCalledWith(50, expect.any(Number));
    });

    it('should default offset to 0 when not provided', async () => {
      await useCase.execute({});

      expect(repo.findAll).toHaveBeenCalledWith(expect.any(Number), 0);
    });

    it('should pass the provided offset to findAll', async () => {
      await useCase.execute({ offset: 40 });

      expect(repo.findAll).toHaveBeenCalledWith(expect.any(Number), 40);
    });

    it('should include the effective limit in the response DTO', async () => {
      const result = await useCase.execute({ limit: 10 });

      expect(result.value!.limit).toBe(10);
    });

    it('should include the effective offset in the response DTO', async () => {
      const result = await useCase.execute({ offset: 20 });

      expect(result.value!.offset).toBe(20);
    });
  });

  // =========================================================================
  describe('executeImpl — hasMore calculation', () => {
    it('should set hasMore to true when more items exist beyond the current page', async () => {
      (repo.findAll as any).mockResolvedValue(Result.ok([makeVendor()]));
      (repo.count as any).mockResolvedValue(Result.ok(5));

      const result = await useCase.execute({ limit: 1, offset: 0 });

      expect(result.value!.hasMore).toBe(true);
    });

    it('should set hasMore to false when the current page covers all items', async () => {
      (repo.findAll as any).mockResolvedValue(
        Result.ok([makeVendor(), makeVendor()])
      );
      (repo.count as any).mockResolvedValue(Result.ok(2));

      const result = await useCase.execute({ limit: 20, offset: 0 });

      expect(result.value!.hasMore).toBe(false);
    });

    it('should set hasMore to false when the vendors array is empty', async () => {
      (repo.findAll as any).mockResolvedValue(Result.ok([]));
      (repo.count as any).mockResolvedValue(Result.ok(0));

      const result = await useCase.execute({});

      expect(result.value!.hasMore).toBe(false);
    });
  });

  // =========================================================================
  describe('executeImpl — repository failures', () => {
    it('should fail when findAll returns a failure', async () => {
      (repo.findAll as any).mockResolvedValue(Result.fail('DB error'));

      const result = await useCase.execute({});

      expect(result.isFailure).toBe(true);
    });

    it('should carry the findAll error message through on failure', async () => {
      (repo.findAll as any).mockResolvedValue(Result.fail('DB error'));

      const result = await useCase.execute({});

      expect(result.error).toContain('DB error');
    });

    it('should fail when count returns a failure', async () => {
      (repo.count as any).mockResolvedValue(Result.fail('Count query failed'));

      const result = await useCase.execute({});

      expect(result.isFailure).toBe(true);
    });

    it('should carry the count error message through on failure', async () => {
      (repo.count as any).mockResolvedValue(Result.fail('Count query failed'));

      const result = await useCase.execute({});

      expect(result.error).toContain('Count query failed');
    });

    it('should not call count when findAll fails', async () => {
      (repo.findAll as any).mockResolvedValue(Result.fail('DB error'));

      await useCase.execute({});

      expect(repo.count).not.toHaveBeenCalled();
    });
  });
});
