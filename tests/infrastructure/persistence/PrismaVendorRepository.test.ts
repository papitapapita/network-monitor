// Source: src/infrastructure/persistence/PrismaVendorRepository.ts

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaVendorRepository } from '../../../src/infrastructure/persistence/PrismaVendorRepository';
import { VendorId } from '../../../src/domain/shared/ids/VendorId';
import { Vendor } from '../../../src/domain/device-inventory/aggregates/Vendor';
import { EventDispatcher } from '../../../src/domain/shared/core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NOW = new Date('2024-01-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeRawRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    name: 'Mikrotik',
    slug: 'mikrotik',
    description: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

function makePrisma() {
  return {
    vendor: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    }
  };
}

function makeVendor(): Vendor {
  const id = VendorId.parse(VALID_UUID).value!;
  return Vendor.reconstitute(id, {
    name: 'Mikrotik',
    slug: 'mikrotik',
    description: null,
    createdAt: NOW,
    updatedAt: NOW
  });
}

// ---------------------------------------------------------------------------

describe('PrismaVendorRepository', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let repository: PrismaVendorRepository;
  let vendor: Vendor;
  let vendorId: VendorId;
  let dispatchSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    prisma = makePrisma();
    repository = new PrismaVendorRepository(prisma as any);
    vendor = makeVendor();
    vendorId = VendorId.parse(VALID_UUID).value!;

    dispatchSpy = jest
      .spyOn(EventDispatcher, 'dispatchEventsForAggregate')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    dispatchSpy.mockRestore();
  });

  // =========================================================================
  describe('save()', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should call prisma.vendor.upsert exactly once', async () => {
        (prisma.vendor.upsert as any).mockResolvedValue(makeRawRow());

        await repository.save(vendor);

        expect(prisma.vendor.upsert).toHaveBeenCalledTimes(1);
      });

      it('should return isSuccess=true when upsert succeeds', async () => {
        (prisma.vendor.upsert as any).mockResolvedValue(makeRawRow());

        const result = await repository.save(vendor);

        expect(result.isSuccess).toBe(true);
      });

      it('should return the original vendor in the Result value', async () => {
        (prisma.vendor.upsert as any).mockResolvedValue(makeRawRow());

        const result = await repository.save(vendor);

        expect(result.value!.id.toString()).toBe(VALID_UUID);
      });

      it('should dispatch events for the aggregate after a successful upsert', async () => {
        (prisma.vendor.upsert as any).mockResolvedValue(makeRawRow());

        await repository.save(vendor);

        expect(dispatchSpy).toHaveBeenCalledWith(vendor.id);
      });
    });

    // -----------------------------------------------------------------------
    describe('Prisma P2002 unique constraint error', () => {
      it('should return isFailure=true when Prisma throws a P2002 error', async () => {
        (prisma.vendor.upsert as any).mockRejectedValue(
          new Error('Unique constraint failed P2002')
        );

        const result = await repository.save(vendor);

        expect(result.isFailure).toBe(true);
      });

      it('should include "already exists" in the error message for P2002', async () => {
        (prisma.vendor.upsert as any).mockRejectedValue(
          new Error('P2002 constraint')
        );

        const result = await repository.save(vendor);

        expect(result.error).toContain('already exists');
      });

      it('should not dispatch events when upsert fails with P2002', async () => {
        (prisma.vendor.upsert as any).mockRejectedValue(
          new Error('P2002 violation')
        );

        await repository.save(vendor);

        expect(dispatchSpy).not.toHaveBeenCalled();
      });
    });

    // -----------------------------------------------------------------------
    describe('generic database error', () => {
      it('should return isFailure=true when Prisma throws a generic error', async () => {
        (prisma.vendor.upsert as any).mockRejectedValue(
          new Error('Connection refused')
        );

        const result = await repository.save(vendor);

        expect(result.isFailure).toBe(true);
      });

      it('should include the original error message in the failure', async () => {
        (prisma.vendor.upsert as any).mockRejectedValue(
          new Error('timeout exceeded')
        );

        const result = await repository.save(vendor);

        expect(result.error).toContain('timeout exceeded');
      });
    });
  });

  // =========================================================================
  describe('findById()', () => {
    // -----------------------------------------------------------------------
    describe('record found', () => {
      it('should call prisma.vendor.findUnique with the correct where clause (no include)', async () => {
        (prisma.vendor.findUnique as any).mockResolvedValue(makeRawRow());

        await repository.findById(vendorId);

        expect(prisma.vendor.findUnique).toHaveBeenCalledWith({
          where: { id: VALID_UUID }
        });
      });

      it('should return isSuccess=true when the record exists', async () => {
        (prisma.vendor.findUnique as any).mockResolvedValue(makeRawRow());

        const result = await repository.findById(vendorId);

        expect(result.isSuccess).toBe(true);
      });

      it('should map name from the raw row', async () => {
        (prisma.vendor.findUnique as any).mockResolvedValue(
          makeRawRow({ name: 'Cisco' })
        );

        const result = await repository.findById(vendorId);

        expect(result.value!.name).toBe('Cisco');
      });

      it('should map slug from the raw row', async () => {
        (prisma.vendor.findUnique as any).mockResolvedValue(
          makeRawRow({ slug: 'cisco' })
        );

        const result = await repository.findById(vendorId);

        expect(result.value!.slug).toBe('cisco');
      });
    });

    // -----------------------------------------------------------------------
    describe('record not found', () => {
      it('should return Result.ok(null) when findUnique returns null', async () => {
        (prisma.vendor.findUnique as any).mockResolvedValue(null);

        const result = await repository.findById(vendorId);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    describe('database error', () => {
      it('should return isFailure=true when Prisma throws', async () => {
        (prisma.vendor.findUnique as any).mockRejectedValue(
          new Error('DB read timeout')
        );

        const result = await repository.findById(vendorId);

        expect(result.isFailure).toBe(true);
      });

      it('should include the original error message in the failure', async () => {
        (prisma.vendor.findUnique as any).mockRejectedValue(
          new Error('network failure')
        );

        const result = await repository.findById(vendorId);

        expect(result.error).toContain('network failure');
      });
    });
  });

  // =========================================================================
  describe('findBySlug()', () => {
    // -----------------------------------------------------------------------
    describe('record found', () => {
      it('should call prisma.vendor.findUnique with where slug', async () => {
        (prisma.vendor.findUnique as any).mockResolvedValue(makeRawRow());

        await repository.findBySlug('mikrotik');

        expect(prisma.vendor.findUnique).toHaveBeenCalledWith({
          where: { slug: 'mikrotik' }
        });
      });

      it('should return isSuccess=true when a vendor with the slug exists', async () => {
        (prisma.vendor.findUnique as any).mockResolvedValue(makeRawRow());

        const result = await repository.findBySlug('mikrotik');

        expect(result.isSuccess).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('record not found', () => {
      it('should return Result.ok(null) when no vendor with the slug exists', async () => {
        (prisma.vendor.findUnique as any).mockResolvedValue(null);

        const result = await repository.findBySlug('unknown-slug');

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    describe('database error', () => {
      it('should return isFailure=true when Prisma throws', async () => {
        (prisma.vendor.findUnique as any).mockRejectedValue(
          new Error('query timeout')
        );

        const result = await repository.findBySlug('mikrotik');

        expect(result.isFailure).toBe(true);
      });
    });
  });

  // =========================================================================
  describe('findAll()', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should call prisma.vendor.findMany with take and skip when limit and offset are provided', async () => {
        (prisma.vendor.findMany as any).mockResolvedValue([]);

        await repository.findAll(10, 5);

        expect(prisma.vendor.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take: 10, skip: 5 })
        );
      });

      it('should call prisma.vendor.findMany with orderBy name asc', async () => {
        (prisma.vendor.findMany as any).mockResolvedValue([]);

        await repository.findAll();

        expect(prisma.vendor.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ orderBy: { name: 'asc' } })
        );
      });

      it('should return a successful Result containing an array of mapped Vendor aggregates', async () => {
        (prisma.vendor.findMany as any).mockResolvedValue([makeRawRow()]);

        const result = await repository.findAll();

        expect(result.isSuccess).toBe(true);
        expect(result.value).toHaveLength(1);
        expect(result.value![0]).toBeInstanceOf(Vendor);
      });

      it('should return a successful Result with an empty array when no records exist', async () => {
        (prisma.vendor.findMany as any).mockResolvedValue([]);

        const result = await repository.findAll();

        expect(result.isSuccess).toBe(true);
        expect(result.value).toHaveLength(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('database error', () => {
      it('should return isFailure=true when Prisma throws', async () => {
        (prisma.vendor.findMany as any).mockRejectedValue(
          new Error('connection lost')
        );

        const result = await repository.findAll();

        expect(result.isFailure).toBe(true);
      });

      it('should include the original error message in the failure', async () => {
        (prisma.vendor.findMany as any).mockRejectedValue(
          new Error('io error')
        );

        const result = await repository.findAll();

        expect(result.error).toContain('io error');
      });
    });
  });

  // =========================================================================
  describe('delete()', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should call prisma.vendor.delete with the correct where clause', async () => {
        (prisma.vendor.delete as any).mockResolvedValue(makeRawRow());

        await repository.delete(vendorId);

        expect(prisma.vendor.delete).toHaveBeenCalledWith({
          where: { id: VALID_UUID }
        });
      });

      it('should return isSuccess=true on successful delete', async () => {
        (prisma.vendor.delete as any).mockResolvedValue(makeRawRow());

        const result = await repository.delete(vendorId);

        expect(result.isSuccess).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('P2025 — record not found', () => {
      it('should return isFailure=true when Prisma throws a P2025 error', async () => {
        (prisma.vendor.delete as any).mockRejectedValue(
          new Error('Record to delete does not exist P2025')
        );

        const result = await repository.delete(vendorId);

        expect(result.isFailure).toBe(true);
      });

      it('should include "not found" in the error message for P2025', async () => {
        (prisma.vendor.delete as any).mockRejectedValue(
          new Error('P2025: Record not found')
        );

        const result = await repository.delete(vendorId);

        expect(result.error).toContain('not found');
      });
    });

    // -----------------------------------------------------------------------
    describe('generic database error', () => {
      it('should return isFailure=true for any other Prisma error', async () => {
        (prisma.vendor.delete as any).mockRejectedValue(
          new Error('foreign key constraint violation')
        );

        const result = await repository.delete(vendorId);

        expect(result.isFailure).toBe(true);
      });

      it('should include the original error message in the failure', async () => {
        (prisma.vendor.delete as any).mockRejectedValue(
          new Error('disk full')
        );

        const result = await repository.delete(vendorId);

        expect(result.error).toContain('disk full');
      });
    });
  });

  // =========================================================================
  describe('exists()', () => {
    // -----------------------------------------------------------------------
    describe('record exists', () => {
      it('should call prisma.vendor.count with where id', async () => {
        (prisma.vendor.count as any).mockResolvedValue(1);

        await repository.exists(vendorId);

        expect(prisma.vendor.count).toHaveBeenCalledWith({
          where: { id: VALID_UUID }
        });
      });

      it('should return true when count is greater than zero', async () => {
        (prisma.vendor.count as any).mockResolvedValue(1);

        const result = await repository.exists(vendorId);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('record does not exist', () => {
      it('should return false when count is zero', async () => {
        (prisma.vendor.count as any).mockResolvedValue(0);

        const result = await repository.exists(vendorId);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(false);
      });
    });
  });

  // =========================================================================
  describe('existsBySlug()', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should call prisma.vendor.count with where slug', async () => {
        (prisma.vendor.count as any).mockResolvedValue(1);

        await repository.existsBySlug('mikrotik');

        expect(prisma.vendor.count).toHaveBeenCalledWith({
          where: { slug: 'mikrotik' }
        });
      });

      it('should return true when count is greater than zero', async () => {
        (prisma.vendor.count as any).mockResolvedValue(1);

        const result = await repository.existsBySlug('mikrotik');

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should return false when count is zero', async () => {
        (prisma.vendor.count as any).mockResolvedValue(0);

        const result = await repository.existsBySlug('unknown');

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(false);
      });
    });
  });

  // =========================================================================
  describe('count()', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should return isSuccess=true with the correct count number', async () => {
        (prisma.vendor.count as any).mockResolvedValue(7);

        const result = await repository.count();

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(7);
      });

      it('should return zero when there are no vendor records', async () => {
        (prisma.vendor.count as any).mockResolvedValue(0);

        const result = await repository.count();

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('database error', () => {
      it('should return isFailure=true when Prisma throws', async () => {
        (prisma.vendor.count as any).mockRejectedValue(
          new Error('replica unavailable')
        );

        const result = await repository.count();

        expect(result.isFailure).toBe(true);
      });

      it('should include the original error message in the failure', async () => {
        (prisma.vendor.count as any).mockRejectedValue(new Error('timeout'));

        const result = await repository.count();

        expect(result.error).toContain('timeout');
      });
    });
  });
});
