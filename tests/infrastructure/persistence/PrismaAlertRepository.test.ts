// Source: src/infrastructure/persistence/PrismaAlertRepository.ts

import { PrismaAlertRepository } from '../../../src/infrastructure/persistence/PrismaAlertRepository';
import { AlertMapper } from '../../../src/infrastructure/mappers/AlertMapper';
import { Alert } from '../../../src/domain/notifications/aggregates/Alert';
import { AlertId } from '../../../src/domain/shared/ids/AlertId';
import { DeviceId } from '../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../src/domain/shared/enums/AlertSeverity';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

jest.mock('../../../src/infrastructure/mappers/AlertMapper');

const MockedAlertMapper = AlertMapper as jest.Mocked<
  typeof AlertMapper
>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_UUID_1 = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440001';

// ---------------------------------------------------------------------------
// Fake Prisma client factory
// ---------------------------------------------------------------------------

function makeFakePrismaClient(): {
  alertEvent: {
    upsert: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    deleteMany: jest.Mock;
  };
} {
  return {
    alertEvent: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn()
    }
  };
}

// ---------------------------------------------------------------------------
// Fake raw Prisma row factory
// ---------------------------------------------------------------------------

function makeRawAlertRecord(
  id = VALID_UUID_1
): Record<string, unknown> {
  return {
    id,
    deviceId: VALID_UUID_2,
    severity: 'WARNING',
    startedAt: new Date('2024-01-01T00:00:00.000Z'),
    resolvedAt: null,
    notifiedAt: null,
    recoveryNotifiedAt: null
  };
}

// ---------------------------------------------------------------------------
// Fake persistence data factory (output of AlertMapper.toPersistence)
// ---------------------------------------------------------------------------

function makeFakePersistenceData(
  id = VALID_UUID_1
): Record<string, unknown> {
  return {
    id,
    deviceId: VALID_UUID_2,
    severity: 'WARNING',
    startedAt: new Date('2024-01-01T00:00:00.000Z'),
    resolvedAt: null,
    notifiedAt: null,
    recoveryNotifiedAt: null
  };
}

// ---------------------------------------------------------------------------
// Fake domain Alert factory
// ---------------------------------------------------------------------------

function makeFakeAlert(id = VALID_UUID_1): Alert {
  const alertId = AlertId.parse(id).value;
  const deviceId = DeviceId.parse(VALID_UUID_2).value;
  return Alert.reconstitute(alertId, {
    deviceId,
    severity: AlertSeverity.WARNING,
    source: 'Disponibilidad',
    type: 'device_unreachable',
    description: 'Sin conexión',
    startedAt: new Date('2024-01-01T00:00:00.000Z'),
    resolvedAt: null,
    notifiedAt: null,
    recoveryNotifiedAt: null
  });
}

// ---------------------------------------------------------------------------

describe('PrismaAlertRepository', () => {
  let prisma: ReturnType<typeof makeFakePrismaClient>;
  let repository: PrismaAlertRepository;
  let fakeAlert: Alert;
  let fakePersistenceData: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = makeFakePrismaClient();
    repository = new PrismaAlertRepository(prisma as never);

    fakeAlert = makeFakeAlert();
    fakePersistenceData = makeFakePersistenceData();

    MockedAlertMapper.toPersistence.mockReturnValue(
      fakePersistenceData as never
    );
    MockedAlertMapper.toDomain.mockReturnValue(fakeAlert);
  });

  // =========================================================================
  describe('save()', () => {
    // -----------------------------------------------------------------------
    describe('success', () => {
      it('should call prisma.alertEvent.upsert with the correct where clause', async () => {
        prisma.alertEvent.upsert.mockResolvedValue(
          fakePersistenceData
        );

        await repository.save(fakeAlert);

        expect(prisma.alertEvent.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: fakePersistenceData.id }
          })
        );
      });

      it('should call prisma.alertEvent.upsert with create set to the full persistence data', async () => {
        prisma.alertEvent.upsert.mockResolvedValue(
          fakePersistenceData
        );

        await repository.save(fakeAlert);

        expect(prisma.alertEvent.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: fakePersistenceData
          })
        );
      });

      it('should update only the lifecycle timestamps and the cause link', async () => {
        prisma.alertEvent.upsert.mockResolvedValue(
          fakePersistenceData
        );

        await repository.save(fakeAlert);

        const call = prisma.alertEvent.upsert.mock
          .calls[0][0] as Record<string, Record<string, unknown>>;

        expect(Object.keys(call.update).sort()).toEqual([
          'causedByAlertId',
          'notifiedAt',
          'recoveryNotifiedAt',
          'resolvedAt'
        ]);
      });

      it('[NOT-229] should leave a timestamp this copy has as null untouched, never clear it', async () => {
        prisma.alertEvent.upsert.mockResolvedValue(
          fakePersistenceData
        );

        await repository.save(fakeAlert);

        const call = prisma.alertEvent.upsert.mock
          .calls[0][0] as Record<string, Record<string, unknown>>;
        expect(call.update.resolvedAt).toBeUndefined();
        expect(call.update.notifiedAt).toBeUndefined();
        expect(call.update.recoveryNotifiedAt).toBeUndefined();
      });

      it('[NOT-229] should write the timestamps this copy has set', async () => {
        const resolvedAt = new Date('2024-01-02T00:00:00.000Z');
        const notifiedAt = new Date('2024-01-01T01:00:00.000Z');
        MockedAlertMapper.toPersistence.mockReturnValue({
          ...fakePersistenceData,
          resolvedAt,
          notifiedAt
        } as never);
        prisma.alertEvent.upsert.mockResolvedValue(
          fakePersistenceData
        );

        await repository.save(fakeAlert);

        const call = prisma.alertEvent.upsert.mock
          .calls[0][0] as Record<string, Record<string, unknown>>;
        expect(call.update.resolvedAt).toBe(resolvedAt);
        expect(call.update.notifiedAt).toBe(notifiedAt);
        expect(call.update.recoveryNotifiedAt).toBeUndefined();
      });

      it('should not include id, deviceId, severity, or startedAt in the update clause', async () => {
        prisma.alertEvent.upsert.mockResolvedValue(
          fakePersistenceData
        );

        await repository.save(fakeAlert);

        const call = prisma.alertEvent.upsert.mock
          .calls[0][0] as Record<string, Record<string, unknown>>;
        const updateKeys = Object.keys(call.update);

        expect(updateKeys).not.toContain('id');
        expect(updateKeys).not.toContain('deviceId');
        expect(updateKeys).not.toContain('severity');
        expect(updateKeys).not.toContain('startedAt');
      });

      it('should return Result.ok containing the original alert on success', async () => {
        prisma.alertEvent.upsert.mockResolvedValue(
          fakePersistenceData
        );

        const result = await repository.save(fakeAlert);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(fakeAlert);
      });

      it('should call upsert exactly once', async () => {
        prisma.alertEvent.upsert.mockResolvedValue(
          fakePersistenceData
        );

        await repository.save(fakeAlert);

        expect(prisma.alertEvent.upsert).toHaveBeenCalledTimes(1);
      });
    });

    // -----------------------------------------------------------------------
    describe('Prisma error', () => {
      it('should return a failed Result when Prisma throws', async () => {
        prisma.alertEvent.upsert.mockRejectedValue(
          new Error('Connection timed out')
        );

        const result = await repository.save(fakeAlert);

        expect(result.isFailure).toBe(true);
      });

      it('should prefix the error message with "save failed:"', async () => {
        prisma.alertEvent.upsert.mockRejectedValue(
          new Error('disk full')
        );

        const result = await repository.save(fakeAlert);

        expect(result.error).toContain('Database error saving alert');
      });

      it('should include the original error message in the failure', async () => {
        prisma.alertEvent.upsert.mockRejectedValue(
          new Error('Connection timed out')
        );

        const result = await repository.save(fakeAlert);

        expect(result.error).toContain('Connection timed out');
      });
    });
  });

  // =========================================================================
  describe('findById()', () => {
    // -----------------------------------------------------------------------
    describe('record not found', () => {
      it('should return Result.ok(null) when Prisma returns null', async () => {
        prisma.alertEvent.findUnique.mockResolvedValue(null);

        const alertId = AlertId.parse(VALID_UUID_1).value;
        const result = await repository.findById(alertId);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeNull();
      });

      it('should not call AlertMapper.toDomain when no record is found', async () => {
        prisma.alertEvent.findUnique.mockResolvedValue(null);

        const alertId = AlertId.parse(VALID_UUID_1).value;
        await repository.findById(alertId);

        expect(MockedAlertMapper.toDomain).not.toHaveBeenCalled();
      });
    });

    // -----------------------------------------------------------------------
    describe('record found', () => {
      it('should call prisma.alertEvent.findUnique with the stringified id', async () => {
        prisma.alertEvent.findUnique.mockResolvedValue(
          makeRawAlertRecord()
        );

        const alertId = AlertId.parse(VALID_UUID_1).value;
        await repository.findById(alertId);

        expect(prisma.alertEvent.findUnique).toHaveBeenCalledWith({
          where: { id: VALID_UUID_1 }
        });
      });

      it('should return Result.ok containing the mapped Alert', async () => {
        prisma.alertEvent.findUnique.mockResolvedValue(
          makeRawAlertRecord()
        );

        const alertId = AlertId.parse(VALID_UUID_1).value;
        const result = await repository.findById(alertId);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(fakeAlert);
      });

      it('should call AlertMapper.toDomain with the raw row', async () => {
        const rawRow = makeRawAlertRecord();
        prisma.alertEvent.findUnique.mockResolvedValue(rawRow);

        const alertId = AlertId.parse(VALID_UUID_1).value;
        await repository.findById(alertId);

        expect(MockedAlertMapper.toDomain).toHaveBeenCalledWith(
          rawRow
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('Prisma error', () => {
      it('should return a failed Result when Prisma throws', async () => {
        prisma.alertEvent.findUnique.mockRejectedValue(
          new Error('DB timeout')
        );

        const alertId = AlertId.parse(VALID_UUID_1).value;
        const result = await repository.findById(alertId);

        expect(result.isFailure).toBe(true);
      });

      it('should prefix the error message with "findById failed:"', async () => {
        prisma.alertEvent.findUnique.mockRejectedValue(
          new Error('network failure')
        );

        const alertId = AlertId.parse(VALID_UUID_1).value;
        const result = await repository.findById(alertId);

        expect(result.error).toContain(
          'Database error finding alert'
        );
      });

      it('should include the original error message in the failure', async () => {
        prisma.alertEvent.findUnique.mockRejectedValue(
          new Error('network failure')
        );

        const alertId = AlertId.parse(VALID_UUID_1).value;
        const result = await repository.findById(alertId);

        expect(result.error).toContain('network failure');
      });
    });
  });

  // =========================================================================
  describe('findOpenByDeviceAndType()', () => {
    // -----------------------------------------------------------------------
    describe('query construction', () => {
      it('should call prisma.alertEvent.findFirst with deviceId string and resolvedAt: null filter', async () => {
        prisma.alertEvent.findFirst.mockResolvedValue(null);

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        await repository.findOpenByDeviceAndType(
          deviceId,
          'device_unreachable'
        );

        expect(prisma.alertEvent.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              deviceId: VALID_UUID_2,
              type: 'device_unreachable',
              resolvedAt: null
            }
          })
        );
      });

      it('should call prisma.alertEvent.findFirst with orderBy: { startedAt: "desc" }', async () => {
        prisma.alertEvent.findFirst.mockResolvedValue(null);

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        await repository.findOpenByDeviceAndType(
          deviceId,
          'device_unreachable'
        );

        expect(prisma.alertEvent.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { startedAt: 'desc' }
          })
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('record not found', () => {
      it('should return Result.ok(null) when no open alert exists', async () => {
        prisma.alertEvent.findFirst.mockResolvedValue(null);

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        const result = await repository.findOpenByDeviceAndType(
          deviceId,
          'device_unreachable'
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    describe('record found', () => {
      it('should return Result.ok containing the mapped Alert', async () => {
        prisma.alertEvent.findFirst.mockResolvedValue(
          makeRawAlertRecord()
        );

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        const result = await repository.findOpenByDeviceAndType(
          deviceId,
          'device_unreachable'
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(fakeAlert);
      });
    });

    // -----------------------------------------------------------------------
    describe('Prisma error', () => {
      it('should return a failed Result when Prisma throws', async () => {
        prisma.alertEvent.findFirst.mockRejectedValue(
          new Error('connection lost')
        );

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        const result = await repository.findOpenByDeviceAndType(
          deviceId,
          'device_unreachable'
        );

        expect(result.isFailure).toBe(true);
      });

      it('should prefix the error message with "Database error finding open alert"', async () => {
        prisma.alertEvent.findFirst.mockRejectedValue(
          new Error('socket error')
        );

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        const result = await repository.findOpenByDeviceAndType(
          deviceId,
          'device_unreachable'
        );

        expect(result.error).toContain(
          'Database error finding open alert'
        );
      });

      it('should include the original error message in the failure', async () => {
        prisma.alertEvent.findFirst.mockRejectedValue(
          new Error('socket error')
        );

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        const result = await repository.findOpenByDeviceAndType(
          deviceId,
          'device_unreachable'
        );

        expect(result.error).toContain('socket error');
      });
    });
  });

  // =========================================================================
  describe('findAllOpenByType()', () => {
    it('should query unresolved alerts of that type, oldest first', async () => {
      prisma.alertEvent.findMany.mockResolvedValue([]);

      await repository.findAllOpenByType('device_unreachable');

      expect(prisma.alertEvent.findMany).toHaveBeenCalledWith({
        where: { type: 'device_unreachable', resolvedAt: null },
        orderBy: { startedAt: 'asc' }
      });
    });

    it('should map every row to an Alert', async () => {
      prisma.alertEvent.findMany.mockResolvedValue([
        makeRawAlertRecord(),
        makeRawAlertRecord(VALID_UUID_2)
      ]);

      const result = await repository.findAllOpenByType(
        'device_unreachable'
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(2);
      expect(MockedAlertMapper.toDomain).toHaveBeenCalledTimes(2);
    });

    it('should return a failed Result when Prisma throws', async () => {
      prisma.alertEvent.findMany.mockRejectedValue(
        new Error('socket error')
      );

      const result = await repository.findAllOpenByType(
        'device_unreachable'
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('socket error');
    });
  });

  // =========================================================================
  describe('deleteResolvedOlderThan()', () => {
    const CUTOFF_DATE = new Date('2024-01-01T00:00:00.000Z');

    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should call prisma.alertEvent.deleteMany with resolvedAt not null and lt cutoff', async () => {
        prisma.alertEvent.deleteMany.mockResolvedValue({ count: 4 });

        await repository.deleteResolvedOlderThan(CUTOFF_DATE);

        expect(prisma.alertEvent.deleteMany).toHaveBeenCalledWith({
          where: { resolvedAt: { not: null, lt: CUTOFF_DATE } }
        });
      });

      it('should return Result.ok with the number of deleted alerts', async () => {
        prisma.alertEvent.deleteMany.mockResolvedValue({ count: 4 });

        const result =
          await repository.deleteResolvedOlderThan(CUTOFF_DATE);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(4);
      });

      it('should return Result.ok(0) when no resolved alerts are older than the cutoff', async () => {
        prisma.alertEvent.deleteMany.mockResolvedValue({ count: 0 });

        const result =
          await repository.deleteResolvedOlderThan(CUTOFF_DATE);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(0);
      });

      it('should call deleteMany exactly once', async () => {
        prisma.alertEvent.deleteMany.mockResolvedValue({ count: 2 });

        await repository.deleteResolvedOlderThan(CUTOFF_DATE);

        expect(prisma.alertEvent.deleteMany).toHaveBeenCalledTimes(1);
      });
    });

    // -----------------------------------------------------------------------
    describe('failure path', () => {
      it('should return a failed Result when Prisma throws', async () => {
        prisma.alertEvent.deleteMany.mockRejectedValue(
          new Error('foreign key constraint')
        );

        const result =
          await repository.deleteResolvedOlderThan(CUTOFF_DATE);

        expect(result.isFailure).toBe(true);
      });

      it('should prefix the error message with "deleteResolvedOlderThan failed:"', async () => {
        prisma.alertEvent.deleteMany.mockRejectedValue(
          new Error('deadlock detected')
        );

        const result =
          await repository.deleteResolvedOlderThan(CUTOFF_DATE);

        expect(result.error).toContain(
          'deleteResolvedOlderThan failed'
        );
      });

      it('should include the original error message in the failure', async () => {
        prisma.alertEvent.deleteMany.mockRejectedValue(
          new Error('foreign key constraint')
        );

        const result =
          await repository.deleteResolvedOlderThan(CUTOFF_DATE);

        expect(result.error).toContain('foreign key constraint');
      });
    });
  });
});
