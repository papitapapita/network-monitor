// Source: src/infrastructure/persistence/PrismaDeviceStateRepository.ts

import { PrismaDeviceStateRepository } from '../../../src/infrastructure/persistence/PrismaDeviceStateRepository';
import { DeviceStateMapper } from '../../../src/infrastructure/mappers/DeviceStateMapper';
import { EventDispatcher } from '../../../src/domain/shared/core/EventDispatcher';
import { DeviceState } from '../../../src/domain/device-monitoring/aggregates/DeviceState';
import { DeviceId } from '../../../src/domain/shared/ids/DeviceId';
import { DeviceStateProps } from '../../../src/domain/device-monitoring/props/DeviceStateProps';
import { ReachabilityStatus } from '../../../src/domain/device-monitoring/value-objects/ReachabilityStatus';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

jest.mock('../../../src/infrastructure/mappers/DeviceStateMapper');

const MockedMapper = DeviceStateMapper as jest.Mocked<
  typeof DeviceStateMapper
>;

// ---------------------------------------------------------------------------
// Constants & Fixtures
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_ROW_ID = 'db-row-uuid-001';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

function makeDeviceId(): DeviceId {
  return DeviceId.parse(VALID_DEVICE_UUID).value;
}

function makeFakePrismaClient() {
  return {
    deviceState: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn()
    }
  };
}

function makeFakePrismaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_ROW_ID,
    deviceId: VALID_DEVICE_UUID,
    status: 'UP',
    lastSeen: FIXED_DATE,
    lastLatencyMs: 20,
    consecutiveFailures: 0,
    lastCheckedAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides
  };
}

function makeFakeDomainState(
  overrides: Partial<DeviceStateProps> = {}
): DeviceState {
  const deviceId = makeDeviceId();
  const props: DeviceStateProps = {
    deviceId,
    status: ReachabilityStatus.createUp(),
    lastSeen: FIXED_DATE,
    lastLatencyMs: 20,
    consecutiveFailures: 0,
    lastCheckedAt: FIXED_DATE,
    downSince: null,
    updatedAt: FIXED_DATE,
    ...overrides
  };
  return DeviceState.reconstitute(deviceId, props);
}

function makeFakePersistenceData(): ReturnType<
  typeof DeviceStateMapper.toPersistence
> {
  return {
    deviceId: VALID_DEVICE_UUID,
    status: 'UP',
    lastSeen: FIXED_DATE,
    lastLatencyMs: 20,
    consecutiveFailures: 0,
    lastCheckedAt: FIXED_DATE,
    downSince: null
  };
}

// ---------------------------------------------------------------------------

describe('PrismaDeviceStateRepository', () => {
  let prisma: ReturnType<typeof makeFakePrismaClient>;
  let repo: PrismaDeviceStateRepository;
  let fakeState: DeviceState;
  let markSpy: jest.SpyInstance;
  let dispatchSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = makeFakePrismaClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repo = new PrismaDeviceStateRepository(prisma as any);
    fakeState = makeFakeDomainState();

    MockedMapper.toDomain.mockReturnValue(fakeState);
    MockedMapper.toPersistence.mockReturnValue(
      makeFakePersistenceData()
    );

    markSpy = jest
      .spyOn(EventDispatcher, 'markAggregateForDispatch')
      .mockImplementation(() => undefined);
    dispatchSpy = jest
      .spyOn(EventDispatcher, 'dispatchEventsForAggregate')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // ===========================================================================
  describe('findByDeviceId()', () => {
    it('should call prisma.deviceState.findUnique with the correct deviceId string', async () => {
      prisma.deviceState.findUnique.mockResolvedValue(
        makeFakePrismaRow()
      );

      await repo.findByDeviceId(makeDeviceId());

      expect(prisma.deviceState.findUnique).toHaveBeenCalledWith({
        where: { deviceId: VALID_DEVICE_UUID }
      });
    });

    it('should return a successful Result when a record exists', async () => {
      prisma.deviceState.findUnique.mockResolvedValue(
        makeFakePrismaRow()
      );

      const result = await repo.findByDeviceId(makeDeviceId());

      expect(result.isSuccess).toBe(true);
    });

    it('should delegate mapping to DeviceStateMapper.toDomain', async () => {
      prisma.deviceState.findUnique.mockResolvedValue(
        makeFakePrismaRow()
      );

      await repo.findByDeviceId(makeDeviceId());

      expect(MockedMapper.toDomain).toHaveBeenCalledTimes(1);
    });

    it('should return the DeviceState produced by the mapper', async () => {
      prisma.deviceState.findUnique.mockResolvedValue(
        makeFakePrismaRow()
      );

      const result = await repo.findByDeviceId(makeDeviceId());

      expect(result.value).toBe(fakeState);
    });

    it('should return a successful Result with null when no record exists', async () => {
      prisma.deviceState.findUnique.mockResolvedValue(null);

      const result = await repo.findByDeviceId(makeDeviceId());

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should not call DeviceStateMapper.toDomain when no record exists', async () => {
      prisma.deviceState.findUnique.mockResolvedValue(null);

      await repo.findByDeviceId(makeDeviceId());

      expect(MockedMapper.toDomain).not.toHaveBeenCalled();
    });

    it('should return a failed Result when Prisma throws', async () => {
      prisma.deviceState.findUnique.mockRejectedValue(
        new Error('Connection refused')
      );

      const result = await repo.findByDeviceId(makeDeviceId());

      expect(result.isFailure).toBe(true);
    });

    it('should include "findByDeviceId failed" in the error message on Prisma error', async () => {
      prisma.deviceState.findUnique.mockRejectedValue(
        new Error('DB timeout')
      );

      const result = await repo.findByDeviceId(makeDeviceId());

      expect(result.error).toContain('findByDeviceId failed');
    });

    it('should propagate the original Prisma error message within the failure', async () => {
      prisma.deviceState.findUnique.mockRejectedValue(
        new Error('network error')
      );

      const result = await repo.findByDeviceId(makeDeviceId());

      expect(result.error).toContain('network error');
    });
  });

  // ===========================================================================
  describe('findOverdueDown()', () => {
    const CUTOFF = new Date('2024-06-01T09:00:00.000Z');

    it('should query prisma.deviceState.findMany for DOWN devices at or before the cutoff', async () => {
      prisma.deviceState.findMany.mockResolvedValue([]);

      await repo.findOverdueDown(CUTOFF);

      expect(prisma.deviceState.findMany).toHaveBeenCalledWith({
        where: { status: 'DOWN', downSince: { lte: CUTOFF } }
      });
    });

    it('should map every returned row through DeviceStateMapper.toDomain', async () => {
      prisma.deviceState.findMany.mockResolvedValue([
        makeFakePrismaRow(),
        makeFakePrismaRow({ deviceId: VALID_DEVICE_UUID })
      ]);

      await repo.findOverdueDown(CUTOFF);

      expect(MockedMapper.toDomain).toHaveBeenCalledTimes(2);
    });

    it('should return a successful Result with the mapped states', async () => {
      prisma.deviceState.findMany.mockResolvedValue([
        makeFakePrismaRow()
      ]);

      const result = await repo.findOverdueDown(CUTOFF);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([fakeState]);
    });

    it('should return a successful Result with an empty array when nothing is overdue', async () => {
      prisma.deviceState.findMany.mockResolvedValue([]);

      const result = await repo.findOverdueDown(CUTOFF);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
    });

    it('should return a failed Result when Prisma throws', async () => {
      prisma.deviceState.findMany.mockRejectedValue(
        new Error('Connection refused')
      );

      const result = await repo.findOverdueDown(CUTOFF);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('findOverdueDown failed');
    });
  });

  // ===========================================================================
  describe('save()', () => {
    it('should call DeviceStateMapper.toPersistence with the DeviceState', async () => {
      prisma.deviceState.upsert.mockResolvedValue(
        makeFakePrismaRow()
      );

      await repo.save(fakeState);

      expect(MockedMapper.toPersistence).toHaveBeenCalledWith(
        fakeState
      );
    });

    it('should call EventDispatcher.markAggregateForDispatch with the DeviceState', async () => {
      prisma.deviceState.upsert.mockResolvedValue(
        makeFakePrismaRow()
      );

      await repo.save(fakeState);

      expect(markSpy).toHaveBeenCalledWith(fakeState);
    });

    it('should call EventDispatcher.markAggregateForDispatch before the upsert', async () => {
      let markCalledBeforeUpsert = false;

      prisma.deviceState.upsert.mockImplementation(async () => {
        markCalledBeforeUpsert = markSpy.mock.calls.length > 0;
        return makeFakePrismaRow();
      });

      await repo.save(fakeState);

      expect(markCalledBeforeUpsert).toBe(true);
    });

    it('should call prisma.deviceState.upsert with the correct where clause', async () => {
      prisma.deviceState.upsert.mockResolvedValue(
        makeFakePrismaRow()
      );

      await repo.save(fakeState);

      expect(prisma.deviceState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deviceId: VALID_DEVICE_UUID }
        })
      );
    });

    it('should call prisma.deviceState.upsert exactly once', async () => {
      prisma.deviceState.upsert.mockResolvedValue(
        makeFakePrismaRow()
      );

      await repo.save(fakeState);

      expect(prisma.deviceState.upsert).toHaveBeenCalledTimes(1);
    });

    it('should call EventDispatcher.dispatchEventsForAggregate with the aggregate id', async () => {
      prisma.deviceState.upsert.mockResolvedValue(
        makeFakePrismaRow()
      );

      await repo.save(fakeState);

      expect(dispatchSpy).toHaveBeenCalledWith(fakeState.id);
    });

    it('should call markAggregateForDispatch before dispatchEventsForAggregate', async () => {
      const callOrder: string[] = [];

      markSpy.mockImplementation(() => {
        callOrder.push('mark');
      });
      dispatchSpy.mockImplementation(() => {
        callOrder.push('dispatch');
      });

      prisma.deviceState.upsert.mockResolvedValue(
        makeFakePrismaRow()
      );

      await repo.save(fakeState);

      expect(callOrder).toEqual(['mark', 'dispatch']);
    });

    it('should return a successful Result on save', async () => {
      prisma.deviceState.upsert.mockResolvedValue(
        makeFakePrismaRow()
      );

      const result = await repo.save(fakeState);

      expect(result.isSuccess).toBe(true);
    });

    it('should return the same DeviceState instance that was passed in', async () => {
      prisma.deviceState.upsert.mockResolvedValue(
        makeFakePrismaRow()
      );

      const result = await repo.save(fakeState);

      expect(result.value).toBe(fakeState);
    });

    it('should return a failed Result when Prisma throws', async () => {
      prisma.deviceState.upsert.mockRejectedValue(
        new Error('Foreign key violation')
      );

      const result = await repo.save(fakeState);

      expect(result.isFailure).toBe(true);
    });

    it('should include "save failed" in the error message on Prisma error', async () => {
      prisma.deviceState.upsert.mockRejectedValue(
        new Error('Unique constraint')
      );

      const result = await repo.save(fakeState);

      expect(result.error).toContain('save failed');
    });

    it('should propagate the original Prisma error message within the failure', async () => {
      prisma.deviceState.upsert.mockRejectedValue(
        new Error('deadlock detected')
      );

      const result = await repo.save(fakeState);

      expect(result.error).toContain('deadlock detected');
    });

    it('should not call dispatchEventsForAggregate when Prisma throws', async () => {
      prisma.deviceState.upsert.mockRejectedValue(
        new Error('DB down')
      );

      await repo.save(fakeState);

      expect(dispatchSpy).not.toHaveBeenCalled();
    });
  });
});
