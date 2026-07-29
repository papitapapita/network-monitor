// Source: src/application/device-inventory/use-cases/CreateVendorUseCase.ts

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { CreateVendorUseCase } from '../../../../src/application/device-inventory/use-cases/CreateVendorUseCase';
import { IVendorRepository } from '../../../../src/domain/device-inventory/repository/IVendorRepository';
import { Vendor } from '../../../../src/domain/device-inventory/aggregates/Vendor';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

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

// ---------------------------------------------------------------------------

describe('CreateVendorUseCase', () => {
  let repo: jest.Mocked<IVendorRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: CreateVendorUseCase;

  beforeEach(() => {
    repo = makeRepo();
    logger = makeLogger();
    useCase = new CreateVendorUseCase(repo, logger);

    (repo.existsBySlug as any).mockResolvedValue(Result.ok(false));
    (repo.save as any).mockImplementation(async (v: Vendor) => Result.ok(v));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('[DEV-001] [DEV-002] [DEV-006] beforeExecute — required field validation', () => {
    it('should fail when name is an empty string', async () => {
      const result = await useCase.execute({ name: '', slug: 'mikrotik' });

      expect(result.isFailure).toBe(true);
    });

    it('should return an error mentioning "name" when name is empty', async () => {
      const result = await useCase.execute({ name: '', slug: 'mikrotik' });

      expect(result.error).toContain('name');
    });

    it('should fail when name is whitespace only', async () => {
      const result = await useCase.execute({ name: '   ', slug: 'mikrotik' });

      expect(result.isFailure).toBe(true);
    });

    it('should fail when slug is an empty string', async () => {
      const result = await useCase.execute({ name: 'Mikrotik', slug: '' });

      expect(result.isFailure).toBe(true);
    });

    it('should return an error mentioning "slug" when slug is empty', async () => {
      const result = await useCase.execute({ name: 'Mikrotik', slug: '' });

      expect(result.error).toContain('slug');
    });

    it('should fail when slug is whitespace only', async () => {
      const result = await useCase.execute({ name: 'Mikrotik', slug: '   ' });

      expect(result.isFailure).toBe(true);
    });

    it('should not call the repository when beforeExecute fails', async () => {
      await useCase.execute({ name: '', slug: 'mikrotik' });

      expect(repo.existsBySlug).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('[DEV-003] executeImpl — slug conflict check', () => {
    it('should fail when a vendor with the same slug already exists', async () => {
      (repo.existsBySlug as any).mockResolvedValue(Result.ok(true));

      const result = await useCase.execute({ name: 'Mikrotik', slug: 'mikrotik' });

      expect(result.isFailure).toBe(true);
    });

    it('should include "already exists" in the error when slug is taken', async () => {
      (repo.existsBySlug as any).mockResolvedValue(Result.ok(true));

      const result = await useCase.execute({ name: 'Mikrotik', slug: 'mikrotik' });

      expect(result.error).toContain('already exists');
    });

    it('should propagate a repository failure from existsBySlug', async () => {
      (repo.existsBySlug as any).mockResolvedValue(Result.fail('DB timeout'));

      const result = await useCase.execute({ name: 'Mikrotik', slug: 'mikrotik' });

      expect(result.isFailure).toBe(true);
    });

    it('should not call save when existsBySlug returns a failure', async () => {
      (repo.existsBySlug as any).mockResolvedValue(Result.fail('DB timeout'));

      await useCase.execute({ name: 'Mikrotik', slug: 'mikrotik' });

      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — save failure', () => {
    it('should fail when repository save returns a failure', async () => {
      (repo.save as any).mockResolvedValue(Result.fail('Unique constraint violated'));

      const result = await useCase.execute({ name: 'Mikrotik', slug: 'mikrotik' });

      expect(result.isFailure).toBe(true);
    });

    it('should include a descriptive message when save fails', async () => {
      (repo.save as any).mockResolvedValue(Result.fail('Unique constraint violated'));

      const result = await useCase.execute({ name: 'Mikrotik', slug: 'mikrotik' });

      expect(result.error).toContain('persist');
    });
  });

  // =========================================================================
  describe('executeImpl — happy path', () => {
    it('should return isSuccess true', async () => {
      const result = await useCase.execute({ name: 'Mikrotik', slug: 'mikrotik' });

      expect(result.isSuccess).toBe(true);
    });

    it('should return a DTO with the correct name', async () => {
      const result = await useCase.execute({ name: 'Mikrotik', slug: 'mikrotik' });

      expect(result.value!.name).toBe('Mikrotik');
    });

    it('should return a DTO with the correct slug', async () => {
      const result = await useCase.execute({ name: 'Mikrotik', slug: 'mikrotik' });

      expect(result.value!.slug).toBe('mikrotik');
    });

    it('should return a DTO with description null when not provided', async () => {
      const result = await useCase.execute({ name: 'Mikrotik', slug: 'mikrotik' });

      expect(result.value!.description).toBeNull();
    });

    it('should return a DTO with the provided description', async () => {
      const result = await useCase.execute({
        name: 'Mikrotik',
        slug: 'mikrotik',
        description: 'Latvian networking vendor'
      });

      expect(result.value!.description).toBe('Latvian networking vendor');
    });

    it('should return a DTO with a string id', async () => {
      const result = await useCase.execute({ name: 'Mikrotik', slug: 'mikrotik' });

      expect(typeof result.value!.id).toBe('string');
    });

    it('should call existsBySlug once with the trimmed slug', async () => {
      await useCase.execute({ name: 'Mikrotik', slug: ' mikrotik ' });

      expect(repo.existsBySlug).toHaveBeenCalledWith('mikrotik');
    });

    it('should call save exactly once', async () => {
      await useCase.execute({ name: 'Mikrotik', slug: 'mikrotik' });

      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('should pass a Vendor instance to save', async () => {
      await useCase.execute({ name: 'Mikrotik', slug: 'mikrotik' });

      const savedArg = (repo.save as any).mock.calls[0][0];
      expect(savedArg).toBeInstanceOf(Vendor);
    });
  });
});
