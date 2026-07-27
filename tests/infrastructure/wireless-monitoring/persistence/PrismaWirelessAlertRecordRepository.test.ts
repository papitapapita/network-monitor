// Source: src/infrastructure/wireless-monitoring/repositories/PrismaWirelessAlertRecordRepository.ts

import { PrismaWirelessAlertRecordRepository } from '../../../../src/infrastructure/wireless-monitoring/repositories/PrismaWirelessAlertRecordRepository';
import { EventDispatcher } from 'domain/shared/core';
import { WirelessAlertRecord } from 'domain/wireless-monitoring';
import { DeviceId } from 'domain/shared';
import { WirelessAlertRecordId } from 'domain/shared/ids';
import type { PrismaClient } from '../../../../src/generated/prisma/client';

const DEVICE_UUID = 'f149790a-58f0-479a-8534-b0b01e9942bb';
const RECORD_UUID  = '6c2bb658-cce2-4dde-b81e-029d5856e42a';

const createMockPrisma = () => ({
  wirelessAlertRecord: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
});

const buildDomainRecord = (): WirelessAlertRecord => {
  const deviceId = DeviceId.parse(DEVICE_UUID).value;
  const id = WirelessAlertRecordId.parse(RECORD_UUID).value;

  return WirelessAlertRecord.reconstitute(
    id,
    {
      deviceId,
      metric: 'signalRxDbm',
      severity: 'WARNING',
      threshold: -70,
      triggeredAt: new Date('2024-01-01T10:00:00Z'),
      clearedAt: null,
      isActive: true,
      lastValue: -75,
      message: 'Signal below threshold',
      notifiedAt: null,
    }
  );
};

const makePrismaRow = () => ({
  id: RECORD_UUID,
  deviceId: DEVICE_UUID,
  metric: 'signalRxDbm',
  severity: 'WARNING',
  threshold: { toNumber: () => -70 },
  triggeredAt: new Date('2024-01-01T10:00:00Z'),
  clearedAt: null,
  isActive: true,
  lastValue: { toNumber: () => -75 },
  message: 'Signal below threshold',
  notifiedAt: null,
});

describe('PrismaWirelessAlertRecordRepository', () => {
  let prismaMock: ReturnType<typeof createMockPrisma>;
  let repository: PrismaWirelessAlertRecordRepository;
  let spyMark: jest.SpyInstance;
  let spyDispatch: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    EventDispatcher.clearHandlers();
    EventDispatcher.clearMarkedAggregates();
    prismaMock = createMockPrisma();
    repository = new PrismaWirelessAlertRecordRepository(prismaMock as unknown as PrismaClient);
    spyMark = jest.spyOn(EventDispatcher, 'markAggregateForDispatch');
    spyDispatch = jest.spyOn(EventDispatcher, 'dispatchEventsForAggregate');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('save', () => {
    it('should call prisma.wirelessAlertRecord.upsert with create and update payloads', async () => {
      prismaMock.wirelessAlertRecord.upsert.mockResolvedValue({});
      const record = buildDomainRecord();

      const result = await repository.save(record);

      expect(prismaMock.wirelessAlertRecord.upsert).toHaveBeenCalledTimes(1);
      const arg = prismaMock.wirelessAlertRecord.upsert.mock.calls[0][0] as {
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      };
      expect(arg.where).toEqual({ id: RECORD_UUID });
      expect(arg.create).toMatchObject({ id: RECORD_UUID, deviceId: DEVICE_UUID, metric: 'signalRxDbm' });
      expect(arg.update).toMatchObject({ isActive: true, lastValue: -75 });
      expect(result.isSuccess).toBe(true);
    });

    it('should mark the aggregate for dispatch before persisting', async () => {
      prismaMock.wirelessAlertRecord.upsert.mockResolvedValue({});
      const record = buildDomainRecord();

      await repository.save(record);

      expect(spyMark).toHaveBeenCalledWith(record);
    });

    it('should dispatch events for the aggregate after successfully persisting', async () => {
      prismaMock.wirelessAlertRecord.upsert.mockResolvedValue({});
      const record = buildDomainRecord();

      await repository.save(record);

      expect(spyDispatch).toHaveBeenCalledWith(record.id);
    });

    it('should dispatch events after upsert, not before', async () => {
      const callOrder: string[] = [];
      prismaMock.wirelessAlertRecord.upsert.mockImplementation(async () => {
        callOrder.push('upsert');
        return {};
      });
      spyDispatch.mockImplementation(() => {
        callOrder.push('dispatch');
      });

      await repository.save(buildDomainRecord());

      expect(callOrder).toEqual(['upsert', 'dispatch']);
    });

    it('should return a failed Result when prisma.wirelessAlertRecord.upsert throws', async () => {
      prismaMock.wirelessAlertRecord.upsert.mockRejectedValue(new Error('unique constraint'));
      const record = buildDomainRecord();

      const result = await repository.save(record);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error saving wireless alert record');
    });

    it('should not dispatch events when upsert throws', async () => {
      prismaMock.wirelessAlertRecord.upsert.mockRejectedValue(new Error('DB error'));

      await repository.save(buildDomainRecord());

      expect(spyDispatch).not.toHaveBeenCalled();
    });

    it('should return the original record instance on success', async () => {
      prismaMock.wirelessAlertRecord.upsert.mockResolvedValue({});
      const record = buildDomainRecord();

      const result = await repository.save(record);

      expect(result.value).toBe(record);
    });
  });

  describe('findById', () => {
    it('should return a domain aggregate when the record exists', async () => {
      prismaMock.wirelessAlertRecord.findUnique.mockResolvedValue(makePrismaRow());
      const id = WirelessAlertRecordId.parse(RECORD_UUID).value;

      const result = await repository.findById(id);

      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();
      expect(result.value!.id.toString()).toBe(RECORD_UUID);
    });

    it('should call findUnique with the string representation of the id', async () => {
      prismaMock.wirelessAlertRecord.findUnique.mockResolvedValue(null);
      const id = WirelessAlertRecordId.parse(RECORD_UUID).value;

      await repository.findById(id);

      expect(prismaMock.wirelessAlertRecord.findUnique).toHaveBeenCalledWith({
        where: { id: RECORD_UUID },
      });
    });

    it('should return Result.ok(null) when no record is found', async () => {
      prismaMock.wirelessAlertRecord.findUnique.mockResolvedValue(null);
      const id = WirelessAlertRecordId.parse(RECORD_UUID).value;

      const result = await repository.findById(id);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should return a failed Result when prisma throws', async () => {
      prismaMock.wirelessAlertRecord.findUnique.mockRejectedValue(new Error('timeout'));
      const id = WirelessAlertRecordId.parse(RECORD_UUID).value;

      const result = await repository.findById(id);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error finding wireless alert record');
    });
  });

  describe('exists', () => {
    it('should return true when a record with the given id exists', async () => {
      prismaMock.wirelessAlertRecord.count.mockResolvedValue(1);
      const id = WirelessAlertRecordId.parse(RECORD_UUID).value;

      const result = await repository.exists(id);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should return false when no record with the given id exists', async () => {
      prismaMock.wirelessAlertRecord.count.mockResolvedValue(0);
      const id = WirelessAlertRecordId.parse(RECORD_UUID).value;

      const result = await repository.exists(id);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should return a failed Result when prisma throws', async () => {
      prismaMock.wirelessAlertRecord.count.mockRejectedValue(new Error('DB error'));
      const id = WirelessAlertRecordId.parse(RECORD_UUID).value;

      const result = await repository.exists(id);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error checking wireless alert record existence');
    });
  });

  describe('findActiveByDeviceMetricAndSeverity', () => {
    it('should call findFirst with deviceId, metric, severity, and isActive: true filter', async () => {
      prismaMock.wirelessAlertRecord.findFirst.mockResolvedValue(null);
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      await repository.findActiveByDeviceMetricAndSeverity(deviceId, 'signalRxDbm', 'WARNING');

      expect(prismaMock.wirelessAlertRecord.findFirst).toHaveBeenCalledWith({
        where: {
          deviceId: DEVICE_UUID,
          metric: 'signalRxDbm',
          severity: 'WARNING',
          isActive: true
        },
      });
    });

    it('should return the active alert record when found', async () => {
      prismaMock.wirelessAlertRecord.findFirst.mockResolvedValue(makePrismaRow());
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findActiveByDeviceMetricAndSeverity(deviceId, 'signalRxDbm', 'WARNING');

      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();
      expect(result.value!.isActive).toBe(true);
    });

    it('should return Result.ok(null) when no active record is found for the metric', async () => {
      prismaMock.wirelessAlertRecord.findFirst.mockResolvedValue(null);
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findActiveByDeviceMetricAndSeverity(deviceId, 'signalRxDbm', 'WARNING');

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should return a failed Result when prisma throws', async () => {
      prismaMock.wirelessAlertRecord.findFirst.mockRejectedValue(new Error('query failed'));
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findActiveByDeviceMetricAndSeverity(deviceId, 'signalRxDbm', 'WARNING');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error finding active alert record');
    });
  });

  describe('findActiveUnnotifiedByDevice', () => {
    it('should filter on isActive and a null notifiedAt', async () => {
      prismaMock.wirelessAlertRecord.findMany.mockResolvedValue([]);
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      await repository.findActiveUnnotifiedByDevice(deviceId);

      expect(prismaMock.wirelessAlertRecord.findMany).toHaveBeenCalledWith({
        where: {
          deviceId: DEVICE_UUID,
          isActive: true,
          notifiedAt: null
        },
        orderBy: { triggeredAt: 'asc' }
      });
    });

    it('should map the rows to domain records', async () => {
      prismaMock.wirelessAlertRecord.findMany.mockResolvedValue([
        makePrismaRow()
      ]);
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result =
        await repository.findActiveUnnotifiedByDevice(deviceId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].isNotified).toBe(false);
    });

    it('should return a failed Result when prisma throws', async () => {
      prismaMock.wirelessAlertRecord.findMany.mockRejectedValue(
        new Error('query failed')
      );
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result =
        await repository.findActiveUnnotifiedByDevice(deviceId);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Database error finding unnotified alerts'
      );
    });
  });

  describe('findAllActiveByDevice', () => {
    it('should call findMany with deviceId and isActive: true filter ordered by triggeredAt desc', async () => {
      prismaMock.wirelessAlertRecord.findMany.mockResolvedValue([]);
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      await repository.findAllActiveByDevice(deviceId);

      expect(prismaMock.wirelessAlertRecord.findMany).toHaveBeenCalledWith({
        where: { deviceId: DEVICE_UUID, isActive: true },
        orderBy: { triggeredAt: 'desc' },
      });
    });

    it('should return an array of domain aggregates when active records are found', async () => {
      prismaMock.wirelessAlertRecord.findMany.mockResolvedValue([makePrismaRow()]);
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findAllActiveByDevice(deviceId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);
    });

    it('should return a failed Result when prisma throws', async () => {
      prismaMock.wirelessAlertRecord.findMany.mockRejectedValue(new Error('network error'));
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findAllActiveByDevice(deviceId);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error finding active alerts by device');
    });
  });

  describe('findAllActive', () => {
    it('should call findMany with isActive: true ordered by triggeredAt desc', async () => {
      prismaMock.wirelessAlertRecord.findMany.mockResolvedValue([]);

      await repository.findAllActive();

      expect(prismaMock.wirelessAlertRecord.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { triggeredAt: 'desc' },
      });
    });

    it('should return an array of domain aggregates', async () => {
      prismaMock.wirelessAlertRecord.findMany.mockResolvedValue([makePrismaRow()]);

      const result = await repository.findAllActive();

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);
    });

    it('should return a failed Result when prisma throws', async () => {
      prismaMock.wirelessAlertRecord.findMany.mockRejectedValue(new Error('DB error'));

      const result = await repository.findAllActive();

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error finding all active alerts');
    });
  });

  describe('findHistoryByDevice', () => {
    it('should call findMany with the correct deviceId, date range, and no limit when limit is omitted', async () => {
      prismaMock.wirelessAlertRecord.findMany.mockResolvedValue([]);
      const deviceId = DeviceId.parse(DEVICE_UUID).value;
      const from = new Date('2024-01-01T00:00:00Z');
      const to = new Date('2024-01-02T00:00:00Z');

      await repository.findHistoryByDevice(deviceId, from, to);

      const arg = prismaMock.wirelessAlertRecord.findMany.mock.calls[0][0] as Record<string, unknown>;
      expect(arg['where']).toEqual({ deviceId: DEVICE_UUID, triggeredAt: { gte: from, lte: to } });
      expect(arg['take']).toBeUndefined();
    });

    it('should call findMany with take when limit is provided', async () => {
      prismaMock.wirelessAlertRecord.findMany.mockResolvedValue([]);
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      await repository.findHistoryByDevice(deviceId, new Date(), new Date(), 10);

      const arg = prismaMock.wirelessAlertRecord.findMany.mock.calls[0][0] as Record<string, unknown>;
      expect(arg['take']).toBe(10);
    });

    it('should return a failed Result when prisma throws', async () => {
      prismaMock.wirelessAlertRecord.findMany.mockRejectedValue(new Error('DB error'));
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findHistoryByDevice(deviceId, new Date(), new Date());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error finding alert history');
    });
  });

  describe('deleteClearedOlderThan()', () => {
    const CUTOFF_DATE = new Date('2024-01-01T00:00:00.000Z');

    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should call prisma.wirelessAlertRecord.deleteMany with isActive: false and lt filter on clearedAt', async () => {
        prismaMock.wirelessAlertRecord.deleteMany.mockResolvedValue({ count: 6 });

        await repository.deleteClearedOlderThan(CUTOFF_DATE);

        expect(prismaMock.wirelessAlertRecord.deleteMany).toHaveBeenCalledWith({
          where: { isActive: false, clearedAt: { lt: CUTOFF_DATE } },
        });
      });

      it('should return Result.ok with the number of deleted records', async () => {
        prismaMock.wirelessAlertRecord.deleteMany.mockResolvedValue({ count: 6 });

        const result = await repository.deleteClearedOlderThan(CUTOFF_DATE);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(6);
      });

      it('should return Result.ok(0) when no cleared records are older than the cutoff', async () => {
        prismaMock.wirelessAlertRecord.deleteMany.mockResolvedValue({ count: 0 });

        const result = await repository.deleteClearedOlderThan(CUTOFF_DATE);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(0);
      });

      it('should call deleteMany exactly once', async () => {
        prismaMock.wirelessAlertRecord.deleteMany.mockResolvedValue({ count: 3 });

        await repository.deleteClearedOlderThan(CUTOFF_DATE);

        expect(prismaMock.wirelessAlertRecord.deleteMany).toHaveBeenCalledTimes(1);
      });
    });

    // -----------------------------------------------------------------------
    describe('failure path', () => {
      it('should return a failed Result when Prisma throws', async () => {
        prismaMock.wirelessAlertRecord.deleteMany.mockRejectedValue(
          new Error('transaction rollback')
        );

        const result = await repository.deleteClearedOlderThan(CUTOFF_DATE);

        expect(result.isFailure).toBe(true);
      });

      it('should prefix the error message with "deleteClearedOlderThan failed:"', async () => {
        prismaMock.wirelessAlertRecord.deleteMany.mockRejectedValue(
          new Error('deadlock timeout')
        );

        const result = await repository.deleteClearedOlderThan(CUTOFF_DATE);

        expect(result.error).toContain('deleteClearedOlderThan failed');
      });

      it('should include the original error message in the failure', async () => {
        prismaMock.wirelessAlertRecord.deleteMany.mockRejectedValue(
          new Error('transaction rollback')
        );

        const result = await repository.deleteClearedOlderThan(CUTOFF_DATE);

        expect(result.error).toContain('transaction rollback');
      });
    });
  });
});
