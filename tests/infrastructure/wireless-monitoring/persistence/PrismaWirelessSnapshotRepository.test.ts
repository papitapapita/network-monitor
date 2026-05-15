// Source: src/infrastructure/wireless-monitoring/repositories/PrismaWirelessSnapshotRepository.ts

import { PrismaWirelessSnapshotRepository } from '../../../../src/infrastructure/wireless-monitoring/repositories/PrismaWirelessSnapshotRepository';
import { EventDispatcher } from 'domain/shared/core';
import { WirelessSnapshot, WirelessMetrics } from 'domain/wireless-monitoring';
import { DeviceId } from 'domain/shared';
import { SnapshotId } from 'domain/shared/ids';
import type { PrismaClient } from '../../../../src/generated/prisma/client';

const DEVICE_UUID   = 'f149790a-58f0-479a-8534-b0b01e9942bb';
const SNAPSHOT_UUID = 'd39d887e-e307-484c-b4c4-bdcb55572201';

// Minimal Prisma delegate shape used by the repository — typed as `unknown`
// to avoid deep Prisma-generated type matching while keeping call verification
const createMockPrisma = () => ({
  wirelessSnapshot: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
});

const buildDomainSnapshot = (): WirelessSnapshot => {
  const deviceId = DeviceId.parse(DEVICE_UUID).value;
  const snapshotId = SnapshotId.parse(SNAPSHOT_UUID).value;
  const metrics = WirelessMetrics.reconstitute({
    signalRxDbm: -65, signalTxDbm: null, noiseFloorDbm: -95, snrDb: null,
    ccqPercent: 98, txRateMbps: 54, rxRateMbps: 48, frequencyMhz: 5180,
    channelWidthMhz: null, txPowerDbm: 23, throughputTxBps: null,
    throughputRxBps: null, throughputTxPps: null, throughputRxPps: null,
    lanStatus: 'UP', lanSpeedMbps: 100, lanDuplex: null, uptimeSeconds: 3600,
    cpuLoadPercent: null, memoryUsedPercent: null, firmwareVersion: 'XW.v8.7.1',
    deviceName: 'ubnt-cpe', remoteApMac: null, remoteApName: null,
    distanceM: null, latencyMs: null, clientsConnected: 2, clientsProvisioned: null,
  });

  return WirelessSnapshot.reconstitute(
    { deviceId, deviceType: 'CPE', collectedAt: new Date('2024-01-01T12:00:00Z'), collectionMethod: 'snmp', metrics, clients: [], alerts: [] },
    snapshotId
  );
};

const makePrismaRow = () => ({
  id: SNAPSHOT_UUID,
  deviceId: DEVICE_UUID,
  deviceType: 'CPE',
  collectedAt: new Date('2024-01-01T12:00:00Z'),
  collectionMethod: 'snmp',
  signalRxDbm: -65,
  signalTxDbm: null,
  noiseFloorDbm: -95,
  snrDb: null,
  ccqPercent: 98,
  txRateMbps: { toNumber: () => 54 },
  rxRateMbps: { toNumber: () => 48 },
  frequencyMhz: 5180,
  channelWidthMhz: null,
  txPowerDbm: 23,
  throughputTxBps: null,
  throughputRxBps: null,
  throughputTxPps: null,
  throughputRxPps: null,
  lanStatus: 'UP',
  lanSpeedMbps: 100,
  lanDuplex: null,
  uptimeSeconds: 3600n,
  cpuLoadPercent: null,
  memoryUsedPercent: null,
  firmwareVersion: 'XW.v8.7.1',
  deviceName: 'ubnt-cpe',
  remoteApMac: null,
  remoteApName: null,
  distanceM: null,
  latencyMs: null,
  clientsConnected: 2,
  clientsProvisioned: null,
  clientsJson: null,
});

describe('PrismaWirelessSnapshotRepository', () => {
  let prismaMock: ReturnType<typeof createMockPrisma>;
  let repository: PrismaWirelessSnapshotRepository;
  let spyMark: jest.SpyInstance;
  let spyDispatch: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    EventDispatcher.clearHandlers();
    EventDispatcher.clearMarkedAggregates();
    prismaMock = createMockPrisma();
    repository = new PrismaWirelessSnapshotRepository(prismaMock as unknown as PrismaClient);
    spyMark = jest.spyOn(EventDispatcher, 'markAggregateForDispatch');
    spyDispatch = jest.spyOn(EventDispatcher, 'dispatchEventsForAggregate');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('save', () => {
    it('should call prisma.wirelessSnapshot.create with the mapped persistence data', async () => {
      prismaMock.wirelessSnapshot.create.mockResolvedValue({});
      const snapshot = buildDomainSnapshot();

      const result = await repository.save(snapshot);

      expect(prismaMock.wirelessSnapshot.create).toHaveBeenCalledTimes(1);
      const createArg = prismaMock.wirelessSnapshot.create.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(createArg.data).toMatchObject({ id: SNAPSHOT_UUID, deviceId: DEVICE_UUID });
      expect(result.isSuccess).toBe(true);
    });

    it('should mark the aggregate for dispatch before persisting', async () => {
      prismaMock.wirelessSnapshot.create.mockResolvedValue({});
      const snapshot = buildDomainSnapshot();

      await repository.save(snapshot);

      expect(spyMark).toHaveBeenCalledWith(snapshot);
    });

    it('should dispatch events for the aggregate after successfully persisting', async () => {
      prismaMock.wirelessSnapshot.create.mockResolvedValue({});
      const snapshot = buildDomainSnapshot();

      await repository.save(snapshot);

      expect(spyDispatch).toHaveBeenCalledWith(snapshot.id);
    });

    it('should dispatch events after create, not before', async () => {
      const callOrder: string[] = [];
      prismaMock.wirelessSnapshot.create.mockImplementation(async () => {
        callOrder.push('create');
        return {};
      });
      spyDispatch.mockImplementation(() => {
        callOrder.push('dispatch');
      });

      await repository.save(buildDomainSnapshot());

      expect(callOrder).toEqual(['create', 'dispatch']);
    });

    it('should return a failed Result when prisma.wirelessSnapshot.create throws', async () => {
      prismaMock.wirelessSnapshot.create.mockRejectedValue(new Error('connection refused'));

      const result = await repository.save(buildDomainSnapshot());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error saving wireless snapshot');
      expect(result.error).toContain('connection refused');
    });

    it('should not call dispatchEventsForAggregate when create throws', async () => {
      prismaMock.wirelessSnapshot.create.mockRejectedValue(new Error('DB error'));

      await repository.save(buildDomainSnapshot());

      expect(spyDispatch).not.toHaveBeenCalled();
    });

    it('should return the original snapshot instance on success', async () => {
      prismaMock.wirelessSnapshot.create.mockResolvedValue({});
      const snapshot = buildDomainSnapshot();

      const result = await repository.save(snapshot);

      expect(result.value).toBe(snapshot);
    });
  });

  describe('findById', () => {
    it('should return a domain aggregate wrapped in a successful Result when the record is found', async () => {
      prismaMock.wirelessSnapshot.findUnique.mockResolvedValue(makePrismaRow());
      const id = SnapshotId.parse(SNAPSHOT_UUID).value;

      const result = await repository.findById(id);

      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();
      expect(result.value!.snapshotId.toString()).toBe(SNAPSHOT_UUID);
    });

    it('should call findUnique with the string representation of the id', async () => {
      prismaMock.wirelessSnapshot.findUnique.mockResolvedValue(null);
      const id = SnapshotId.parse(SNAPSHOT_UUID).value;

      await repository.findById(id);

      expect(prismaMock.wirelessSnapshot.findUnique).toHaveBeenCalledWith({
        where: { id: SNAPSHOT_UUID },
      });
    });

    it('should return Result.ok(null) when no record is found', async () => {
      prismaMock.wirelessSnapshot.findUnique.mockResolvedValue(null);
      const id = SnapshotId.parse(SNAPSHOT_UUID).value;

      const result = await repository.findById(id);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should return a failed Result when prisma throws', async () => {
      prismaMock.wirelessSnapshot.findUnique.mockRejectedValue(new Error('query failed'));
      const id = SnapshotId.parse(SNAPSHOT_UUID).value;

      const result = await repository.findById(id);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error finding wireless snapshot by id');
    });
  });

  describe('findLatestByDevice', () => {
    it('should call findFirst with deviceId filter and descending collectedAt order', async () => {
      prismaMock.wirelessSnapshot.findFirst.mockResolvedValue(null);
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      await repository.findLatestByDevice(deviceId);

      expect(prismaMock.wirelessSnapshot.findFirst).toHaveBeenCalledWith({
        where: { deviceId: DEVICE_UUID },
        orderBy: { collectedAt: 'desc' },
      });
    });

    it('should return the most recent snapshot as a domain aggregate on success', async () => {
      prismaMock.wirelessSnapshot.findFirst.mockResolvedValue(makePrismaRow());
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findLatestByDevice(deviceId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();
      expect(result.value!.deviceId.toString()).toBe(DEVICE_UUID);
    });

    it('should return Result.ok(null) when no snapshot exists for the device', async () => {
      prismaMock.wirelessSnapshot.findFirst.mockResolvedValue(null);
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findLatestByDevice(deviceId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should return a failed Result when prisma throws', async () => {
      prismaMock.wirelessSnapshot.findFirst.mockRejectedValue(new Error('timeout'));
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findLatestByDevice(deviceId);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error finding wireless snapshot');
    });
  });

  describe('findHistoryByDevice', () => {
    it('should call findMany with the correct deviceId and date range filter', async () => {
      prismaMock.wirelessSnapshot.findMany.mockResolvedValue([]);
      const deviceId = DeviceId.parse(DEVICE_UUID).value;
      const from = new Date('2024-01-01T00:00:00Z');
      const to = new Date('2024-01-02T00:00:00Z');

      await repository.findHistoryByDevice(deviceId, from, to);

      expect(prismaMock.wirelessSnapshot.findMany).toHaveBeenCalledWith({
        where: { deviceId: DEVICE_UUID, collectedAt: { gte: from, lte: to } },
        orderBy: { collectedAt: 'desc' },
      });
    });

    it('should return an array of domain aggregates when records exist', async () => {
      prismaMock.wirelessSnapshot.findMany.mockResolvedValue([makePrismaRow()]);
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findHistoryByDevice(deviceId, new Date(), new Date());

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);
    });

    it('should return a failed Result when prisma throws', async () => {
      prismaMock.wirelessSnapshot.findMany.mockRejectedValue(new Error('DB error'));
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findHistoryByDevice(deviceId, new Date(), new Date());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error finding wireless history');
    });
  });
});
