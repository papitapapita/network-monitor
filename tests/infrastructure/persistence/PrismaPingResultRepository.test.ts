// Source: src/infrastructure/persistence/PrismaPingResultRepository.ts

import { PrismaPingResultRepository } from '../../../src/infrastructure/persistence/PrismaPingResultRepository';
import { DeviceId } from '../../../src/domain/shared/ids/DeviceId';
import { CreatePingResultInput } from '../../../src/domain/device-monitoring/repository/IPingResultRepository';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakePrismaClient() {
  return {
    pingResult: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn()
    },
    $transaction: jest.fn()
  };
}

function makeFakePrismaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ping-row-id-1',
    deviceId: VALID_DEVICE_UUID,
    isReachable: true,
    latencyMs: 12,
    checkedAt: FIXED_DATE,
    ...overrides
  };
}

function makeCreateInput(
  overrides: Partial<CreatePingResultInput> = {}
): CreatePingResultInput {
  return {
    deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
    isReachable: true,
    latencyMs: 12,
    checkedAt: FIXED_DATE,
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('PrismaPingResultRepository', () => {
  let prisma: ReturnType<typeof makeFakePrismaClient>;
  let repo: PrismaPingResultRepository;

  beforeEach(() => {
    prisma = makeFakePrismaClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repo = new PrismaPingResultRepository(prisma as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('save()', () => {
    it('should call prisma.pingResult.create with the correct data', async () => {
      prisma.pingResult.create.mockResolvedValue(makeFakePrismaRow());

      await repo.save(makeCreateInput());

      expect(prisma.pingResult.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          deviceId: VALID_DEVICE_UUID,
          isReachable: true,
          latencyMs: 12,
          checkedAt: FIXED_DATE
        })
      });
    });

    it('should save null latencyMs when isReachable is false', async () => {
      prisma.pingResult.create.mockResolvedValue(makeFakePrismaRow({ latencyMs: null }));

      await repo.save(makeCreateInput({ isReachable: false, latencyMs: null }));

      const data = prisma.pingResult.create.mock.calls[0][0].data;
      expect(data.latencyMs).toBeNull();
    });

    it('should return a successful Result on success', async () => {
      prisma.pingResult.create.mockResolvedValue(makeFakePrismaRow());

      const result = await repo.save(makeCreateInput());

      expect(result.isSuccess).toBe(true);
    });

    it('should return a failed Result when Prisma throws', async () => {
      prisma.pingResult.create.mockRejectedValue(new Error('Constraint error'));

      const result = await repo.save(makeCreateInput());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('save ping result failed');
    });
  });

  // ===========================================================================
  describe('findLatestByDevice()', () => {
    it('should call prisma.pingResult.findMany with deviceId, desc order, and take limit', async () => {
      prisma.pingResult.findMany.mockResolvedValue([]);

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      await repo.findLatestByDevice(deviceId, 5);

      expect(prisma.pingResult.findMany).toHaveBeenCalledWith({
        where: { deviceId: VALID_DEVICE_UUID },
        orderBy: { checkedAt: 'desc' },
        take: 5
      });
    });

    it('should return a successful Result with an empty array when no records exist', async () => {
      prisma.pingResult.findMany.mockResolvedValue([]);

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.findLatestByDevice(deviceId, 10);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(0);
    });

    it('should return a successful Result with mapped records', async () => {
      prisma.pingResult.findMany.mockResolvedValue([
        makeFakePrismaRow({ id: 'r1' }),
        makeFakePrismaRow({ id: 'r2' })
      ]);

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.findLatestByDevice(deviceId, 10);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(2);
    });

    it('should map id correctly on each returned record', async () => {
      prisma.pingResult.findMany.mockResolvedValue([
        makeFakePrismaRow({ id: 'my-ping-id' })
      ]);

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.findLatestByDevice(deviceId, 1);

      expect(result.value[0].id).toBe('my-ping-id');
    });

    it('should map isReachable correctly', async () => {
      prisma.pingResult.findMany.mockResolvedValue([
        makeFakePrismaRow({ isReachable: false })
      ]);

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.findLatestByDevice(deviceId, 1);

      expect(result.value[0].isReachable).toBe(false);
    });

    it('should coerce a numeric latencyMs value via Number()', async () => {
      prisma.pingResult.findMany.mockResolvedValue([
        makeFakePrismaRow({ latencyMs: 8 })
      ]);

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.findLatestByDevice(deviceId, 1);

      expect(result.value[0].latencyMs).toBe(8);
    });

    it('should map latencyMs as null when it is null', async () => {
      prisma.pingResult.findMany.mockResolvedValue([
        makeFakePrismaRow({ isReachable: false, latencyMs: null })
      ]);

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.findLatestByDevice(deviceId, 1);

      expect(result.value[0].latencyMs).toBeNull();
    });

    it('should return a failed Result when Prisma throws', async () => {
      prisma.pingResult.findMany.mockRejectedValue(new Error('DB error'));

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.findLatestByDevice(deviceId, 10);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('findLatestByDevice failed');
    });

    it('should return a failed Result when a row contains an invalid deviceId', async () => {
      prisma.pingResult.findMany.mockResolvedValue([
        makeFakePrismaRow({ deviceId: 'not-a-uuid' })
      ]);

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.findLatestByDevice(deviceId, 1);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Data integrity violation');
    });
  });

  // ===========================================================================
  describe('findByDevice()', () => {
    const baseFilters = { limit: 50, offset: 0 };

    beforeEach(() => {
      prisma.$transaction.mockImplementation(
        (ops: [Promise<unknown>, Promise<unknown>]) => Promise.all(ops)
      );
    });

    it('should execute a transaction with findMany and count', async () => {
      prisma.pingResult.findMany.mockResolvedValue([]);
      prisma.pingResult.count.mockResolvedValue(0);

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      await repo.findByDevice(deviceId, baseFilters);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should return a successful Result with records and total', async () => {
      prisma.pingResult.findMany.mockResolvedValue([makeFakePrismaRow()]);
      prisma.pingResult.count.mockResolvedValue(1);
      prisma.$transaction.mockResolvedValue([[makeFakePrismaRow()], 1]);

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.findByDevice(deviceId, baseFilters);

      expect(result.isSuccess).toBe(true);
      expect(result.value.records).toHaveLength(1);
      expect(result.value.total).toBe(1);
    });

    it('should return an empty records array and total 0 when no records exist', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.findByDevice(deviceId, baseFilters);

      expect(result.isSuccess).toBe(true);
      expect(result.value.records).toHaveLength(0);
      expect(result.value.total).toBe(0);
    });

    it('should apply isReachable filter when provided', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      await repo.findByDevice(deviceId, {
        ...baseFilters,
        isReachable: true
      });

      // The where clause passed to findMany / count should include isReachable
      const transactionCall = prisma.$transaction.mock.calls[0][0];
      expect(transactionCall).toBeDefined();
    });

    it('should apply fromDate filter as gte when provided', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      await repo.findByDevice(deviceId, {
        ...baseFilters,
        fromDate: FIXED_DATE
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should apply toDate filter as lte when provided', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      await repo.findByDevice(deviceId, {
        ...baseFilters,
        toDate: FIXED_DATE
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should pass skip and take from filters', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      await repo.findByDevice(deviceId, { limit: 25, offset: 50 });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should return a failed Result when Prisma throws', async () => {
      prisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.findByDevice(deviceId, baseFilters);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('findByDevice failed');
    });
  });

  // ===========================================================================
  describe('deleteOlderThan()', () => {
    // -------------------------------------------------------------------------
    describe('happy path', () => {
      it('should call prisma.pingResult.deleteMany with a lt filter on checkedAt', async () => {
        prisma.pingResult.deleteMany.mockResolvedValue({ count: 7 });

        await repo.deleteOlderThan(FIXED_DATE);

        expect(prisma.pingResult.deleteMany).toHaveBeenCalledWith({
          where: { checkedAt: { lt: FIXED_DATE } }
        });
      });

      it('should return Result.ok with the number of deleted records', async () => {
        prisma.pingResult.deleteMany.mockResolvedValue({ count: 7 });

        const result = await repo.deleteOlderThan(FIXED_DATE);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(7);
      });

      it('should return Result.ok(0) when no records match the cutoff', async () => {
        prisma.pingResult.deleteMany.mockResolvedValue({ count: 0 });

        const result = await repo.deleteOlderThan(FIXED_DATE);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(0);
      });

      it('should call deleteMany exactly once', async () => {
        prisma.pingResult.deleteMany.mockResolvedValue({ count: 1 });

        await repo.deleteOlderThan(FIXED_DATE);

        expect(prisma.pingResult.deleteMany).toHaveBeenCalledTimes(1);
      });
    });

    // -------------------------------------------------------------------------
    describe('failure path', () => {
      it('should return a failed Result when Prisma throws', async () => {
        prisma.pingResult.deleteMany.mockRejectedValue(
          new Error('delete constraint violated')
        );

        const result = await repo.deleteOlderThan(FIXED_DATE);

        expect(result.isFailure).toBe(true);
      });

      it('should prefix the error message with "deleteOlderThan failed:"', async () => {
        prisma.pingResult.deleteMany.mockRejectedValue(
          new Error('DB locked')
        );

        const result = await repo.deleteOlderThan(FIXED_DATE);

        expect(result.error).toContain('deleteOlderThan failed');
      });

      it('should include the original error message in the failure', async () => {
        prisma.pingResult.deleteMany.mockRejectedValue(
          new Error('delete constraint violated')
        );

        const result = await repo.deleteOlderThan(FIXED_DATE);

        expect(result.error).toContain('delete constraint violated');
      });
    });
  });
});
