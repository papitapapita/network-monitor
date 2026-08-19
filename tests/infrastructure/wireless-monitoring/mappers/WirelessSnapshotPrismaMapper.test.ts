// Source: src/infrastructure/wireless-monitoring/mappers/WirelessSnapshotPrismaMapper.ts

import { WirelessSnapshotPrismaMapper } from '../../../../src/infrastructure/wireless-monitoring/mappers/WirelessSnapshotPrismaMapper';
import {
  WirelessSnapshot,
  WirelessMetrics,
  WirelessClientEntry
} from 'domain/wireless-monitoring';
import { DeviceId } from 'domain/shared';
import { SnapshotId } from 'domain/shared/ids';

const DEVICE_UUID = 'f149790a-58f0-479a-8534-b0b01e9942bb';
const SNAPSHOT_UUID = 'd39d887e-e307-484c-b4c4-bdcb55572201';

type PrismaWirelessSnapshot = Parameters<
  typeof WirelessSnapshotPrismaMapper.toDomain
>[0];

const makeMinimalPrismaRow = (): PrismaWirelessSnapshot => ({
  id: SNAPSHOT_UUID,
  deviceId: DEVICE_UUID,
  deviceType: 'STATION',
  collectedAt: new Date('2024-01-01T12:00:00Z'),
  collectionMethod: 'snmp',
  signalRxDbm: null,
  signalTxDbm: null,
  noiseFloorDbm: null,
  snrDb: null,
  ccqPercent: null,
  frequencyMhz: null,
  channelWidthMhz: null,
  throughputTxBps: null,
  throughputRxBps: null,
  throughputTxPps: null,
  throughputRxPps: null,
  lanStatus: null,
  lanSpeedMbps: null,
  lanDuplex: null,
  uptimeSeconds: null,
  cpuLoadPercent: null,
  memoryUsedPercent: null,
  firmwareVersion: null,
  deviceName: null,
  remoteApMac: null,
  remoteApName: null,
  remoteApIp: null,
  remoteApDeviceId: null,
  distanceM: null,
  latencyMs: null,
  capacityTxKbps: null,
  capacityRxKbps: null,
  deviceTimeEpoch: null,
  clientsConnected: null,
  clientsJson: null,
  macAddress: null,
  deviceModel: null,
  ssid: null
});

const makeFullPrismaRow = (): PrismaWirelessSnapshot => ({
  id: SNAPSHOT_UUID,
  deviceId: DEVICE_UUID,
  deviceType: 'ACCESS_POINT',
  collectedAt: new Date('2024-06-15T08:30:00Z'),
  collectionMethod: 'http_api',
  signalRxDbm: -65,
  signalTxDbm: -68,
  noiseFloorDbm: -95,
  snrDb: 30,
  ccqPercent: 98,
  frequencyMhz: 5180,
  channelWidthMhz: 40,
  throughputTxBps: 1_000_000n,
  throughputRxBps: 500_000n,
  throughputTxPps: 1000n,
  throughputRxPps: 500n,
  lanStatus: 'UP',
  lanSpeedMbps: 100,
  lanDuplex: 'FULL',
  uptimeSeconds: 7200n,
  cpuLoadPercent: 15,
  memoryUsedPercent: 45,
  firmwareVersion: 'XW.v8.7.1',
  deviceName: 'ubnt-ap-1',
  remoteApMac: 'AA:BB:CC:DD:EE:FF',
  remoteApName: 'tower-ap',
  remoteApIp: '10.0.0.1',
  remoteApDeviceId: null,
  distanceM: 1500,
  latencyMs: 5,
  capacityTxKbps: 20000,
  capacityRxKbps: 40000,
  deviceTimeEpoch: 1718440200n,
  clientsConnected: 3,
  macAddress: 'AA:BB:CC:DD:EE:FF',
  deviceModel: 'Rocket 5AC',
  ssid: 'TestNet',
  clientsJson: [
    {
      macAddress: 'AA:BB:CC:DD:EE:01',
      signalRxDbm: -70,
      signalTxDbm: -72,
      snrDb: null,
      throughputTxBps: null,
      throughputRxBps: null,
      ccqPercent: 96,
      uptimeSeconds: 1200,
      ipAddress: '192.168.200.10'
    }
  ]
});

const buildDomainSnapshot = (
  overrides: Partial<{
    deviceType: 'STATION' | 'ACCESS_POINT';
    collectionMethod: 'snmp' | 'http_api' | 'mixed';
  }> = {}
): WirelessSnapshot => {
  const deviceId = DeviceId.parse(DEVICE_UUID).value;
  const snapshotId = SnapshotId.parse(SNAPSHOT_UUID).value;
  const metrics = WirelessMetrics.reconstitute({
    signalRxDbm: -65,
    signalTxDbm: null,
    noiseFloorDbm: -95,
    snrDb: null,
    ccqPercent: 98,
    frequencyMhz: 5180,
    channelWidthMhz: null,
    throughputTxBps: 1_000_000,
    throughputRxBps: 500_000,
    throughputTxPps: 1000,
    throughputRxPps: 500,
    lanStatus: 'UP',
    lanSpeedMbps: 100,
    lanDuplex: 'FULL',
    uptimeSeconds: 7200,
    cpuLoadPercent: null,
    memoryUsedPercent: null,
    firmwareVersion: 'XW.v8.7.1',
    deviceName: 'ubnt-ap-1',
    remoteApMac: 'AA:BB:CC:DD:EE:FF',
    remoteApName: 'tower-ap',
    remoteApIp: null,
    distanceM: null,
    latencyMs: null,
    capacityTxKbps: null,
    capacityRxKbps: null,
    deviceTimeEpoch: null,
    clientsConnected: 3,
    macAddress: null,
    deviceModel: null,
    ssid: null
  });

  return WirelessSnapshot.reconstitute(snapshotId, {
    deviceId,
    deviceType: overrides.deviceType ?? 'STATION',
    collectedAt: new Date('2024-06-15T08:30:00Z'),
    collectionMethod: overrides.collectionMethod ?? 'snmp',
    metrics,
    clients: [],
    alerts: [],
    remoteApDeviceId: null
  });
};

describe('WirelessSnapshotPrismaMapper', () => {
  describe('toDomain', () => {
    it('should map all scalar metric fields from a full Prisma row to the domain aggregate', () => {
      const row = makeFullPrismaRow();

      const snapshot = WirelessSnapshotPrismaMapper.toDomain(row);

      expect(snapshot.snapshotId.toString()).toBe(SNAPSHOT_UUID);
      expect(snapshot.deviceId.toString()).toBe(DEVICE_UUID);
      expect(snapshot.deviceType).toBe('ACCESS_POINT');
      expect(snapshot.collectionMethod).toBe('http_api');
      expect(snapshot.collectedAt).toEqual(
        new Date('2024-06-15T08:30:00Z')
      );
    });

    it('should convert BigInt throughput fields to numbers', () => {
      const row = makeFullPrismaRow();

      const snapshot = WirelessSnapshotPrismaMapper.toDomain(row);

      expect(snapshot.metrics.throughputTxBps).toBe(1_000_000);
      expect(snapshot.metrics.throughputRxBps).toBe(500_000);
      expect(snapshot.metrics.throughputTxPps).toBe(1000);
      expect(snapshot.metrics.throughputRxPps).toBe(500);
    });

    it('should convert BigInt uptimeSeconds to a number', () => {
      const row = makeFullPrismaRow();

      const snapshot = WirelessSnapshotPrismaMapper.toDomain(row);

      expect(snapshot.metrics.uptimeSeconds).toBe(7200);
    });

    it('should return null for all nullable metric fields when the Prisma row contains null values', () => {
      const row = makeMinimalPrismaRow();

      const snapshot = WirelessSnapshotPrismaMapper.toDomain(row);
      const m = snapshot.metrics;

      expect(m.signalRxDbm).toBeNull();
      expect(m.throughputTxBps).toBeNull();
      expect(m.throughputRxBps).toBeNull();
      expect(m.uptimeSeconds).toBeNull();
    });

    it('should deserialise the clientsJson array into WirelessClientEntry value objects', () => {
      const row = makeFullPrismaRow();

      const snapshot = WirelessSnapshotPrismaMapper.toDomain(row);

      expect(snapshot.clients).toHaveLength(1);
      expect(snapshot.clients[0]!.macAddress).toBe(
        'AA:BB:CC:DD:EE:01'
      );
      expect(snapshot.clients[0]!.signalRxDbm).toBe(-70);
      expect(snapshot.clients[0]!.ipAddress).toBe('192.168.200.10');
    });

    it('should return an empty clients array when clientsJson is null', () => {
      const row = makeMinimalPrismaRow();

      const snapshot = WirelessSnapshotPrismaMapper.toDomain(row);

      expect(snapshot.clients).toHaveLength(0);
    });

    it('should throw when the deviceId is not a valid UUID', () => {
      const row = {
        ...makeMinimalPrismaRow(),
        deviceId: 'not-a-uuid'
      };

      expect(() =>
        WirelessSnapshotPrismaMapper.toDomain(row)
      ).toThrow('Invalid device ID');
    });

    it('should throw when the snapshot id is not a valid UUID', () => {
      const row = { ...makeMinimalPrismaRow(), id: 'bad-id' };

      expect(() =>
        WirelessSnapshotPrismaMapper.toDomain(row)
      ).toThrow('Invalid snapshot ID');
    });
  });

  describe('toPersistence', () => {
    it('should map all domain aggregate fields to the persistence shape', () => {
      const snapshot = buildDomainSnapshot();

      const data =
        WirelessSnapshotPrismaMapper.toPersistence(snapshot);

      expect(data.id).toBe(SNAPSHOT_UUID);
      expect(data.deviceId).toBe(DEVICE_UUID);
      expect(data.deviceType).toBe('STATION');
      expect(data.collectionMethod).toBe('snmp');
    });

    it('should convert number throughput values to BigInt for persistence', () => {
      const snapshot = buildDomainSnapshot();

      const data =
        WirelessSnapshotPrismaMapper.toPersistence(snapshot);

      expect(data.throughputTxBps).toBe(1_000_000n);
      expect(data.throughputRxBps).toBe(500_000n);
      expect(data.throughputTxPps).toBe(1000n);
      expect(data.throughputRxPps).toBe(500n);
    });

    it('should convert number uptimeSeconds to BigInt for persistence', () => {
      const snapshot = buildDomainSnapshot();

      const data =
        WirelessSnapshotPrismaMapper.toPersistence(snapshot);

      expect(data.uptimeSeconds).toBe(7200n);
    });

    it('should set throughput BigInt fields to null when domain metrics have null throughput', () => {
      const deviceId = DeviceId.parse(DEVICE_UUID).value;
      const snapshotId = SnapshotId.parse(SNAPSHOT_UUID).value;
      const metrics = WirelessMetrics.reconstitute({
        signalRxDbm: null,
        signalTxDbm: null,
        noiseFloorDbm: null,
        snrDb: null,
        ccqPercent: null,
        frequencyMhz: null,
        channelWidthMhz: null,
        throughputTxBps: null,
        throughputRxBps: null,
        throughputTxPps: null,
        throughputRxPps: null,
        lanStatus: null,
        lanSpeedMbps: null,
        lanDuplex: null,
        uptimeSeconds: null,
        cpuLoadPercent: null,
        memoryUsedPercent: null,
        firmwareVersion: null,
        deviceName: null,
        remoteApMac: null,
        remoteApName: null,
        remoteApIp: null,
        distanceM: null,
        latencyMs: null,
        capacityTxKbps: null,
        capacityRxKbps: null,
        deviceTimeEpoch: null,
        clientsConnected: null,
        macAddress: null,
        deviceModel: null,
        ssid: null
      });

      const snapshot = WirelessSnapshot.reconstitute(snapshotId, {
        deviceId,
        deviceType: 'STATION',
        collectedAt: new Date(),
        collectionMethod: 'snmp',
        metrics,
        clients: [],
        alerts: [],
        remoteApDeviceId: null
      });

      const data =
        WirelessSnapshotPrismaMapper.toPersistence(snapshot);

      expect(data.throughputTxBps).toBeNull();
      expect(data.throughputRxBps).toBeNull();
      expect(data.uptimeSeconds).toBeNull();
    });

    it('should set clientsJson to null when there are no clients', () => {
      const snapshot = buildDomainSnapshot();

      const data =
        WirelessSnapshotPrismaMapper.toPersistence(snapshot);

      expect(data.clientsJson).toBeNull();
    });

    it('should serialise clients into the clientsJson field when clients are present', () => {
      const deviceId = DeviceId.parse(DEVICE_UUID).value;
      const snapshotId = SnapshotId.parse(SNAPSHOT_UUID).value;
      const metrics = WirelessMetrics.reconstitute({
        signalRxDbm: null,
        signalTxDbm: null,
        noiseFloorDbm: null,
        snrDb: null,
        ccqPercent: null,
        frequencyMhz: null,
        channelWidthMhz: null,
        throughputTxBps: null,
        throughputRxBps: null,
        throughputTxPps: null,
        throughputRxPps: null,
        lanStatus: null,
        lanSpeedMbps: null,
        lanDuplex: null,
        uptimeSeconds: null,
        cpuLoadPercent: null,
        memoryUsedPercent: null,
        firmwareVersion: null,
        deviceName: null,
        remoteApMac: null,
        remoteApName: null,
        remoteApIp: null,
        distanceM: null,
        latencyMs: null,
        capacityTxKbps: null,
        capacityRxKbps: null,
        deviceTimeEpoch: null,
        clientsConnected: null,
        macAddress: null,
        deviceModel: null,
        ssid: null
      });

      const client = WirelessClientEntry.reconstitute({
        macAddress: 'AA:BB:CC:DD:EE:01',
        ipAddress: '192.168.200.10',
        signalRxDbm: -70,
        noiseFloorDbm: -95,
        distanceM: 1000,
        uptimeSeconds: 1200,
        txLatencyMs: null,
        dlLinkScore: 85,
        ulLinkScore: null,
        dlCapacityKbps: null,
        ulCapacityKbps: null,
        dlCinr: null,
        ulCinr: null,
        txBytesTotal: BigInt(500000),
        rxBytesTotal: null,
        txPps: null,
        rxPps: null,
        remoteHostname: 'tower-ap',
        remotePlatform: null,
        remoteVersion: null,
        remoteCpuLoad: null,
        remoteTotalRam: null,
        remoteFreeRam: null,
        remoteSignal: null,
        remoteNoiseFloor: null,
        remoteTxPower: null,
        remoteTxThroughputKbps: null,
        remoteRxThroughputKbps: null,
        remoteIpAddresses: ['10.0.0.1'],
        dlAirtimePercent: null,
        ulAirtimePercent: null
      });

      const snapshot = WirelessSnapshot.reconstitute(snapshotId, {
        deviceId,
        deviceType: 'STATION',
        collectedAt: new Date(),
        collectionMethod: 'http_api',
        metrics,
        clients: [client],
        alerts: [],
        remoteApDeviceId: null
      });

      const data =
        WirelessSnapshotPrismaMapper.toPersistence(snapshot);

      expect(Array.isArray(data.clientsJson)).toBe(true);
      const persisted = (
        data.clientsJson as Record<string, unknown>[]
      )[0]!;
      expect(persisted['macAddress']).toBe('AA:BB:CC:DD:EE:01');
      expect(persisted['signalRxDbm']).toBe(-70);
      expect(persisted['txBytesTotal']).toBe('500000');
    });
  });

  describe('round-trip: toDomain → toPersistence', () => {
    it('should produce persistence data with matching IDs, deviceType, and collectionMethod after a round-trip', () => {
      const row = makeFullPrismaRow();
      const snapshot = WirelessSnapshotPrismaMapper.toDomain(row);
      const back =
        WirelessSnapshotPrismaMapper.toPersistence(snapshot);

      expect(back.id).toBe(row.id);
      expect(back.deviceId).toBe(row.deviceId);
      expect(back.deviceType).toBe(row.deviceType);
      expect(back.collectionMethod).toBe(row.collectionMethod);
    });

    it('should preserve numeric metric fields through a round-trip', () => {
      const row = makeFullPrismaRow();
      const snapshot = WirelessSnapshotPrismaMapper.toDomain(row);
      const back =
        WirelessSnapshotPrismaMapper.toPersistence(snapshot);

      expect(back.signalRxDbm).toBe(row.signalRxDbm);
      expect(back.noiseFloorDbm).toBe(row.noiseFloorDbm);
      expect(back.ccqPercent).toBe(row.ccqPercent);
    });

    it('should preserve BigInt fields as BigInts through a round-trip', () => {
      const row = makeFullPrismaRow();
      const snapshot = WirelessSnapshotPrismaMapper.toDomain(row);
      const back =
        WirelessSnapshotPrismaMapper.toPersistence(snapshot);

      expect(back.throughputTxBps).toBe(row.throughputTxBps);
      expect(back.throughputRxBps).toBe(row.throughputRxBps);
      expect(back.uptimeSeconds).toBe(row.uptimeSeconds);
    });
  });
});
