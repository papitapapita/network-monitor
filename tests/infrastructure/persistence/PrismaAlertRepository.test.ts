// Source: src/infrastructure/persistence/PrismaAlertRepository.ts

import { PrismaAlertRepository } from '../../../src/infrastructure/persistence/PrismaAlertRepository';
import { AlertMapper } from '../../../src/infrastructure/mappers/AlertMapper';
import { Alert } from '../../../src/domain/notifications/aggregates/Alert';
import { AlertId } from '../../../src/domain/shared/ids/AlertId';
import { DeviceId } from '../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../src/domain/notifications/enums/AlertSeverity';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

jest.mock('../../../src/infrastructure/mappers/AlertMapper');

const MockedAlertMapper = AlertMapper as jest.Mocked<typeof AlertMapper>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_UUID_1 = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440001';
const VALID_UUID_3 = '550e8400-e29b-41d4-a716-446655440002';

// ---------------------------------------------------------------------------
// Fake Prisma client factory
// ---------------------------------------------------------------------------

function makeFakePrismaClient(): {
  alertEvent: {
    upsert: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
} {
  return {
    alertEvent: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn()
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
    recoveryNotifiedAt: null,
    durationSecs: null
  };
}

// ---------------------------------------------------------------------------
// Fake persistence data factory (output of AlertMapper.toPersistence)
// ---------------------------------------------------------------------------

function makeFakePersistenceData(id = VALID_UUID_1): Record<string, unknown> {
  return {
    id,
    deviceId: VALID_UUID_2,
    severity: 'WARNING',
    startedAt: new Date('2024-01-01T00:00:00.000Z'),
    resolvedAt: null,
    notifiedAt: null,
    recoveryNotifiedAt: null,
    durationSecs: null
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
    startedAt: new Date('2024-01-01T00:00:00.000Z'),
    resolvedAt: null,
    notifiedAt: null,
    recoveryNotifiedAt: null,
    durationSecs: null
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
        prisma.alertEvent.upsert.mockResolvedValue(fakePersistenceData);

        await repository.save(fakeAlert);

        expect(prisma.alertEvent.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: fakePersistenceData.id }
          })
        );
      });

      it('should call prisma.alertEvent.upsert with create set to the full persistence data', async () => {
        prisma.alertEvent.upsert.mockResolvedValue(fakePersistenceData);

        await repository.save(fakeAlert);

        expect(prisma.alertEvent.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: fakePersistenceData
          })
        );
      });

      it('should include only resolvedAt, notifiedAt, recoveryNotifiedAt, durationSecs in the update clause', async () => {
        prisma.alertEvent.upsert.mockResolvedValue(fakePersistenceData);

        await repository.save(fakeAlert);

        const call = prisma.alertEvent.upsert.mock.calls[0][0] as Record<
          string,
          Record<string, unknown>
        >;

        expect(call.update).toEqual({
          resolvedAt: fakePersistenceData.resolvedAt,
          notifiedAt: fakePersistenceData.notifiedAt,
          recoveryNotifiedAt: fakePersistenceData.recoveryNotifiedAt,
          durationSecs: fakePersistenceData.durationSecs
        });
      });

      it('should not include id, deviceId, severity, or startedAt in the update clause', async () => {
        prisma.alertEvent.upsert.mockResolvedValue(fakePersistenceData);

        await repository.save(fakeAlert);

        const call = prisma.alertEvent.upsert.mock.calls[0][0] as Record<
          string,
          Record<string, unknown>
        >;
        const updateKeys = Object.keys(call.update);

        expect(updateKeys).not.toContain('id');
        expect(updateKeys).not.toContain('deviceId');
        expect(updateKeys).not.toContain('severity');
        expect(updateKeys).not.toContain('startedAt');
      });

      it('should return Result.ok containing the original alert on success', async () => {
        prisma.alertEvent.upsert.mockResolvedValue(fakePersistenceData);

        const result = await repository.save(fakeAlert);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(fakeAlert);
      });

      it('should call upsert exactly once', async () => {
        prisma.alertEvent.upsert.mockResolvedValue(fakePersistenceData);

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

        expect(result.error).toContain('save failed:');
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

        expect(MockedAlertMapper.toDomain).toHaveBeenCalledWith(rawRow);
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

        expect(result.error).toContain('findById failed:');
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
  describe('findOpenByDeviceId()', () => {
    // -----------------------------------------------------------------------
    describe('query construction', () => {
      it('should call prisma.alertEvent.findFirst with deviceId string and resolvedAt: null filter', async () => {
        prisma.alertEvent.findFirst.mockResolvedValue(null);

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        await repository.findOpenByDeviceId(deviceId);

        expect(prisma.alertEvent.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { deviceId: VALID_UUID_2, resolvedAt: null }
          })
        );
      });

      it('should call prisma.alertEvent.findFirst with orderBy: { startedAt: "desc" }', async () => {
        prisma.alertEvent.findFirst.mockResolvedValue(null);

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        await repository.findOpenByDeviceId(deviceId);

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
        const result = await repository.findOpenByDeviceId(deviceId);

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
        const result = await repository.findOpenByDeviceId(deviceId);

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
        const result = await repository.findOpenByDeviceId(deviceId);

        expect(result.isFailure).toBe(true);
      });

      it('should prefix the error message with "findOpenByDeviceId failed:"', async () => {
        prisma.alertEvent.findFirst.mockRejectedValue(
          new Error('socket error')
        );

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        const result = await repository.findOpenByDeviceId(deviceId);

        expect(result.error).toContain('findOpenByDeviceId failed:');
      });

      it('should include the original error message in the failure', async () => {
        prisma.alertEvent.findFirst.mockRejectedValue(
          new Error('socket error')
        );

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        const result = await repository.findOpenByDeviceId(deviceId);

        expect(result.error).toContain('socket error');
      });
    });
  });

  // =========================================================================
  describe('findAllByDeviceId()', () => {
    // -----------------------------------------------------------------------
    describe('query construction', () => {
      it('should call prisma.alertEvent.findMany with the deviceId string filter', async () => {
        prisma.alertEvent.findMany.mockResolvedValue([]);

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        await repository.findAllByDeviceId(deviceId);

        expect(prisma.alertEvent.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { deviceId: VALID_UUID_2 }
          })
        );
      });

      it('should call prisma.alertEvent.findMany with orderBy: { startedAt: "desc" }', async () => {
        prisma.alertEvent.findMany.mockResolvedValue([]);

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        await repository.findAllByDeviceId(deviceId);

        expect(prisma.alertEvent.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { startedAt: 'desc' }
          })
        );
      });

      it('should use default limit of 50 as "take"', async () => {
        prisma.alertEvent.findMany.mockResolvedValue([]);

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        await repository.findAllByDeviceId(deviceId);

        expect(prisma.alertEvent.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take: 50 })
        );
      });

      it('should use default offset of 0 as "skip"', async () => {
        prisma.alertEvent.findMany.mockResolvedValue([]);

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        await repository.findAllByDeviceId(deviceId);

        expect(prisma.alertEvent.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ skip: 0 })
        );
      });

      it('should pass explicit limit as "take"', async () => {
        prisma.alertEvent.findMany.mockResolvedValue([]);

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        await repository.findAllByDeviceId(deviceId, 10);

        expect(prisma.alertEvent.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take: 10 })
        );
      });

      it('should pass explicit offset as "skip"', async () => {
        prisma.alertEvent.findMany.mockResolvedValue([]);

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        await repository.findAllByDeviceId(deviceId, 10, 20);

        expect(prisma.alertEvent.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ skip: 20 })
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('result mapping', () => {
      it('should return Result.ok([]) when no records match', async () => {
        prisma.alertEvent.findMany.mockResolvedValue([]);

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        const result = await repository.findAllByDeviceId(deviceId);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toEqual([]);
      });

      it('should return Result.ok containing all mapped alerts', async () => {
        const alert2 = makeFakeAlert(VALID_UUID_3);

        prisma.alertEvent.findMany.mockResolvedValue([
          makeRawAlertRecord(VALID_UUID_1),
          makeRawAlertRecord(VALID_UUID_3)
        ]);
        MockedAlertMapper.toDomain
          .mockReturnValueOnce(fakeAlert)
          .mockReturnValueOnce(alert2);

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        const result = await repository.findAllByDeviceId(deviceId);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toHaveLength(2);
        expect(result.value[0]).toBe(fakeAlert);
        expect(result.value[1]).toBe(alert2);
      });
    });

    // -----------------------------------------------------------------------
    describe('Prisma error', () => {
      it('should return a failed Result when Prisma throws', async () => {
        prisma.alertEvent.findMany.mockRejectedValue(
          new Error('query timeout')
        );

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        const result = await repository.findAllByDeviceId(deviceId);

        expect(result.isFailure).toBe(true);
      });

      it('should prefix the error message with "findAllByDeviceId failed:"', async () => {
        prisma.alertEvent.findMany.mockRejectedValue(
          new Error('io error')
        );

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        const result = await repository.findAllByDeviceId(deviceId);

        expect(result.error).toContain('findAllByDeviceId failed:');
      });

      it('should include the original error message in the failure', async () => {
        prisma.alertEvent.findMany.mockRejectedValue(
          new Error('query timeout')
        );

        const deviceId = DeviceId.parse(VALID_UUID_2).value;
        const result = await repository.findAllByDeviceId(deviceId);

        expect(result.error).toContain('query timeout');
      });
    });
  });

  // =========================================================================
  describe('findAll()', () => {
    // -----------------------------------------------------------------------
    describe('query construction', () => {
      it('should call prisma.alertEvent.findMany with orderBy: { startedAt: "desc" }', async () => {
        prisma.alertEvent.findMany.mockResolvedValue([]);

        await repository.findAll();

        expect(prisma.alertEvent.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { startedAt: 'desc' }
          })
        );
      });

      it('should use default limit of 50 as "take"', async () => {
        prisma.alertEvent.findMany.mockResolvedValue([]);

        await repository.findAll();

        expect(prisma.alertEvent.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take: 50 })
        );
      });

      it('should use default offset of 0 as "skip"', async () => {
        prisma.alertEvent.findMany.mockResolvedValue([]);

        await repository.findAll();

        expect(prisma.alertEvent.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ skip: 0 })
        );
      });

      it('should pass explicit limit as "take"', async () => {
        prisma.alertEvent.findMany.mockResolvedValue([]);

        await repository.findAll(25);

        expect(prisma.alertEvent.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take: 25 })
        );
      });

      it('should pass explicit offset as "skip"', async () => {
        prisma.alertEvent.findMany.mockResolvedValue([]);

        await repository.findAll(25, 50);

        expect(prisma.alertEvent.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ skip: 50 })
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('result mapping', () => {
      it('should return Result.ok([]) when no records exist', async () => {
        prisma.alertEvent.findMany.mockResolvedValue([]);

        const result = await repository.findAll();

        expect(result.isSuccess).toBe(true);
        expect(result.value).toEqual([]);
      });

      it('should return Result.ok containing all mapped alerts', async () => {
        const alert2 = makeFakeAlert(VALID_UUID_3);

        prisma.alertEvent.findMany.mockResolvedValue([
          makeRawAlertRecord(VALID_UUID_1),
          makeRawAlertRecord(VALID_UUID_3)
        ]);
        MockedAlertMapper.toDomain
          .mockReturnValueOnce(fakeAlert)
          .mockReturnValueOnce(alert2);

        const result = await repository.findAll();

        expect(result.isSuccess).toBe(true);
        expect(result.value).toHaveLength(2);
        expect(result.value[0]).toBe(fakeAlert);
        expect(result.value[1]).toBe(alert2);
      });
    });

    // -----------------------------------------------------------------------
    describe('Prisma error', () => {
      it('should return a failed Result when Prisma throws', async () => {
        prisma.alertEvent.findMany.mockRejectedValue(
          new Error('replica unavailable')
        );

        const result = await repository.findAll();

        expect(result.isFailure).toBe(true);
      });

      it('should prefix the error message with "findAll failed:"', async () => {
        prisma.alertEvent.findMany.mockRejectedValue(
          new Error('timeout')
        );

        const result = await repository.findAll();

        expect(result.error).toContain('findAll failed:');
      });

      it('should include the original error message in the failure', async () => {
        prisma.alertEvent.findMany.mockRejectedValue(
          new Error('replica unavailable')
        );

        const result = await repository.findAll();

        expect(result.error).toContain('replica unavailable');
      });
    });
  });
});
