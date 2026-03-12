// Source: src/infrastructure/persistence/PrismaDeviceModelRepository.ts

import { PrismaDeviceModelRepository } from '../../../src/infrastructure/persistence/PrismaDeviceModelRepository';
import { DeviceModelId } from '../../../src/domain/shared/ids';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NOW = new Date('2024-01-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Prisma raw row factory (matches what prisma.deviceModel methods return)
// ---------------------------------------------------------------------------

function makeRawRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    manufacturer: 'Mikrotik',
    model: 'RB760iGS',
    deviceType: 'ROUTER',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Prisma client mock factory
// ---------------------------------------------------------------------------

function makePrisma() {
  return {
    deviceModel: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
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

      it('should call prisma.deviceModel.findUnique with the correct id', async () => {
        prisma.deviceModel.findUnique.mockResolvedValue(makeRawRow());

        await repository.findById(validId);

        expect(prisma.deviceModel.findUnique).toHaveBeenCalledWith({
          where: { id: VALID_UUID }
        });
      });

      it('should map the raw row id to the DeviceModelRecord', async () => {
        prisma.deviceModel.findUnique.mockResolvedValue(makeRawRow());

        const result = await repository.findById(validId);

        expect(result.value!.id).toBe(VALID_UUID);
      });

      it('should map the raw row manufacturer to the DeviceModelRecord', async () => {
        prisma.deviceModel.findUnique.mockResolvedValue(
          makeRawRow({ manufacturer: 'Ubiquiti' })
        );

        const result = await repository.findById(validId);

        expect(result.value!.manufacturer).toBe('Ubiquiti');
      });

      it('should map the raw row model to the DeviceModelRecord', async () => {
        prisma.deviceModel.findUnique.mockResolvedValue(
          makeRawRow({ model: 'UniFi Switch 24' })
        );

        const result = await repository.findById(validId);

        expect(result.value!.model).toBe('UniFi Switch 24');
      });

      it('should map the raw row deviceType to the DeviceModelRecord', async () => {
        prisma.deviceModel.findUnique.mockResolvedValue(
          makeRawRow({ deviceType: 'SWITCH' })
        );

        const result = await repository.findById(validId);

        expect(result.value!.deviceType).toBe('SWITCH');
      });

      it('should preserve createdAt as a Date', async () => {
        prisma.deviceModel.findUnique.mockResolvedValue(makeRawRow());

        const result = await repository.findById(validId);

        expect(result.value!.createdAt).toEqual(NOW);
      });

      it('should preserve updatedAt as a Date', async () => {
        prisma.deviceModel.findUnique.mockResolvedValue(makeRawRow());

        const result = await repository.findById(validId);

        expect(result.value!.updatedAt).toEqual(NOW);
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
      it('should return a success Result with an array of records', async () => {
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

      it('should order results by manufacturer then model ascending', async () => {
        prisma.deviceModel.findMany.mockResolvedValue([]);

        await repository.findAll(20, 0);

        expect(prisma.deviceModel.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: [{ manufacturer: 'asc' }, { model: 'asc' }]
          })
        );
      });

      it('should map each raw row to a DeviceModelRecord', async () => {
        prisma.deviceModel.findMany.mockResolvedValue([
          makeRawRow({ manufacturer: 'Cisco', model: 'SG300' }),
          makeRawRow({
            id: '550e8400-e29b-41d4-a716-446655440001',
            manufacturer: 'Ubiquiti',
            model: 'UniFi AP'
          })
        ]);

        const result = await repository.findAll(20, 0);

        expect(result.value![0].manufacturer).toBe('Cisco');
        expect(result.value![1].manufacturer).toBe('Ubiquiti');
      });

      it('should return an empty array when no records exist', async () => {
        prisma.deviceModel.findMany.mockResolvedValue([]);

        const result = await repository.findAll(20, 0);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toEqual([]);
      });

      it('should work without limit and offset arguments', async () => {
        prisma.deviceModel.findMany.mockResolvedValue([]);

        const result = await repository.findAll();

        expect(result.isSuccess).toBe(true);
        expect(prisma.deviceModel.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take: undefined, skip: undefined })
        );
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

      it('should call prisma.deviceModel.count with no arguments', async () => {
        prisma.deviceModel.count.mockResolvedValue(0);

        await repository.count();

        expect(prisma.deviceModel.count).toHaveBeenCalledTimes(1);
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
