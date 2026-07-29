// Source: src/infrastructure/persistence/PrismaDeviceModelRepository.ts

import { PrismaDeviceModelRepository } from '../../../src/infrastructure/persistence/PrismaDeviceModelRepository';
import { DeviceModelId } from '../../../src/domain/shared/ids';
import { DeviceModel } from '../../../src/domain/device-inventory/aggregates/DeviceModel';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VENDOR_UUID = '550e8400-e29b-41d4-a716-446655440001';
const NOW = new Date('2024-01-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Prisma raw row factory (matches what prisma.deviceModel.findUnique returns with include vendor)
// ---------------------------------------------------------------------------

function makeRawRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    vendorId: VENDOR_UUID,
    model: 'RB760iGS',
    deviceType: 'ROUTER',
    createdAt: NOW,
    updatedAt: NOW,
    vendor: {
      name: 'Mikrotik',
      slug: 'mikrotik'
    },
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Prisma client mock factory
// ---------------------------------------------------------------------------

function makePrisma() {
  return {
    deviceModel: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    }
  };
}

// ---------------------------------------------------------------------------

describe('PrismaDeviceModelRepository', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let repository: PrismaDeviceModelRepository;
  let validId: DeviceModelId;

  beforeEach(() => {
    prisma = makePrisma();
    repository = new PrismaDeviceModelRepository(prisma as any);
    validId = DeviceModelId.parse(VALID_UUID).value!;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('findById()', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should return a success Result when the record exists', async () => {
        prisma.deviceModel.findUnique.mockResolvedValue(makeRawRow());

        const result = await repository.findById(validId);

        expect(result.isSuccess).toBe(true);
      });

      it('should call prisma.deviceModel.findUnique with id and include vendor', async () => {
        prisma.deviceModel.findUnique.mockResolvedValue(makeRawRow());

        await repository.findById(validId);

        expect(prisma.deviceModel.findUnique).toHaveBeenCalledWith({
          where: { id: VALID_UUID },
          include: { vendor: true }
        });
      });

      it('should return a DeviceModel aggregate with correct id', async () => {
        prisma.deviceModel.findUnique.mockResolvedValue(makeRawRow());

        const result = await repository.findById(validId);

        expect(result.value!.id.toString()).toBe(VALID_UUID);
      });

      it('should map vendorName from the vendor join', async () => {
        prisma.deviceModel.findUnique.mockResolvedValue(
          makeRawRow({ vendor: { name: 'Ubiquiti', slug: 'ubiquiti' } })
        );

        const result = await repository.findById(validId);

        expect((result.value as DeviceModel).vendorName).toBe('Ubiquiti');
      });

      it('should map the raw row model field', async () => {
        prisma.deviceModel.findUnique.mockResolvedValue(
          makeRawRow({ model: 'UniFi Switch 24' })
        );

        const result = await repository.findById(validId);

        expect((result.value as DeviceModel).model).toBe('UniFi Switch 24');
      });

      it('should map the raw row deviceType field', async () => {
        prisma.deviceModel.findUnique.mockResolvedValue(
          makeRawRow({ deviceType: 'SWITCH' })
        );

        const result = await repository.findById(validId);

        expect((result.value as DeviceModel).deviceType.value).toBe(
          'SWITCH'
        );
      });

      it('should preserve createdAt as a Date', async () => {
        prisma.deviceModel.findUnique.mockResolvedValue(makeRawRow());

        const result = await repository.findById(validId);

        expect((result.value as DeviceModel).createdAt).toEqual(NOW);
      });
    });

    // -----------------------------------------------------------------------
    describe('record not found', () => {
      it('should return a success Result with null when the record does not exist', async () => {
        prisma.deviceModel.findUnique.mockResolvedValue(null);

        const result = await repository.findById(validId);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    describe('database error', () => {
      it('should return a failure Result when Prisma throws', async () => {
        prisma.deviceModel.findUnique.mockRejectedValue(
          new Error('Connection lost')
        );

        const result = await repository.findById(validId);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Connection lost');
      });

      it('should include context in the error message', async () => {
        prisma.deviceModel.findUnique.mockRejectedValue(
          new Error('timeout')
        );

        const result = await repository.findById(validId);

        expect(result.error).toContain('device model');
      });
    });
  });

  // =========================================================================
  describe('findAll()', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should return a success Result with an array of aggregates', async () => {
        prisma.deviceModel.findMany.mockResolvedValue([
          makeRawRow(),
          makeRawRow({ id: '550e8400-e29b-41d4-a716-446655440001' })
        ]);

        const result = await repository.findAll(20, 0);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toHaveLength(2);
      });

      it('should call prisma.deviceModel.findMany with correct take and skip', async () => {
        prisma.deviceModel.findMany.mockResolvedValue([]);

        await repository.findAll(10, 5);

        expect(prisma.deviceModel.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take: 10, skip: 5 })
        );
      });

      it('should order results by vendor name then model ascending', async () => {
        prisma.deviceModel.findMany.mockResolvedValue([]);

        await repository.findAll(20, 0);

        expect(prisma.deviceModel.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: [{ vendor: { name: 'asc' } }, { model: 'asc' }]
          })
        );
      });

      it('should return an empty array when no records exist', async () => {
        prisma.deviceModel.findMany.mockResolvedValue([]);

        const result = await repository.findAll(20, 0);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toEqual([]);
      });
    });

    // -----------------------------------------------------------------------
    describe('database error', () => {
      it('should return a failure Result when Prisma throws', async () => {
        prisma.deviceModel.findMany.mockRejectedValue(
          new Error('DB unavailable')
        );

        const result = await repository.findAll(20, 0);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('DB unavailable');
      });
    });
  });

  // =========================================================================
  describe('count()', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should return a success Result with the count', async () => {
        prisma.deviceModel.count.mockResolvedValue(17);

        const result = await repository.count();

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(17);
      });

      it('should return 0 when no records exist', async () => {
        prisma.deviceModel.count.mockResolvedValue(0);

        const result = await repository.count();

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('database error', () => {
      it('should return a failure Result when Prisma throws', async () => {
        prisma.deviceModel.count.mockRejectedValue(
          new Error('Query execution error')
        );

        const result = await repository.count();

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Query execution error');
      });
    });
  });
});
