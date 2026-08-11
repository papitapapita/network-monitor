// Source: src/application/wireless-monitoring/use-cases/GetWirelessClientsUseCase.ts

import { GetWirelessClientsUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetWirelessClientsUseCase';
import { IWirelessSnapshotRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessSnapshotRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { DeviceId, SnapshotId } from '../../../../src/domain/shared/ids';
import { WirelessSnapshot } from '../../../../src/domain/wireless-monitoring';
import { WirelessMetrics } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessMetrics';
import { WirelessClientEntry } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessClientEntry';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const SNAPSHOT_UUID = '550e8400-e29b-41d4-a716-446655440002';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger(): jest.Mocked<ILogger> {
  const child: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setLevel: jest.fn(),
    child: jest.fn(),
  };
  child.child.mockReturnValue(child);
  return child;
}

function makeNullMetrics(): WirelessMetrics {
  return WirelessMetrics.reconstitute({
    signalRxDbm: null, signalTxDbm: null, noiseFloorDbm: null, snrDb: null,
    ccqPercent: null, frequencyMhz: null,
    channelWidthMhz: null, throughputTxBps: null,
    throughputRxBps: null, throughputTxPps: null, throughputRxPps: null,
    lanStatus: null, lanSpeedMbps: null, lanDuplex: null, uptimeSeconds: null,
    cpuLoadPercent: null, memoryUsedPercent: null, firmwareVersion: null,
    deviceName: null, remoteApMac: null, remoteApName: null, remoteApIp: null,
    distanceM: null, latencyMs: null, capacityTxKbps: null, capacityRxKbps: null,
    deviceTimeEpoch: null, clientsConnected: null,
    macAddress: null, deviceModel: null, ssid: null,
  });
}

function makeSnapshot(
  deviceType: 'STATION' | 'ACCESS_POINT',
  clients: WirelessClientEntry[] = []
): WirelessSnapshot {
  const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
  const snapshotId = SnapshotId.parse(SNAPSHOT_UUID).value;
  return WirelessSnapshot.reconstitute(
    snapshotId,
    {
      deviceId,
      deviceType,
      collectedAt: new Date('2024-01-01T00:00:00.000Z'),
      collectionMethod: 'http_api',
      metrics: makeNullMetrics(),
      clients,
      alerts: [],
      remoteApDeviceId: null,
    }
  );
}

function makeClient(macAddress: string): WirelessClientEntry {
  return WirelessClientEntry.reconstitute({
    macAddress,
    ipAddress: '192.168.1.10',
    signalRxDbm: -68,
    noiseFloorDbm: -95,
    distanceM: 1000,
    uptimeSeconds: 3600,
    txLatencyMs: null,
    dlLinkScore: null,
    ulLinkScore: null,
    dlCapacityKbps: null,
    ulCapacityKbps: null,
    dlCinr: null,
    ulCinr: null,
    txBytesTotal: null,
    rxBytesTotal: null,
    txPps: null,
    rxPps: null,
    remoteHostname: null,
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
    remoteIpAddresses: [],
    dlAirtimePercent: null,
    ulAirtimePercent: null,
  });
}

// ---------------------------------------------------------------------------

describe('[WLS-140] [WLS-141] GetWirelessClientsUseCase', () => {
  let snapshotRepo: jest.Mocked<IWirelessSnapshotRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: GetWirelessClientsUseCase;

  beforeEach(() => {
    snapshotRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findLatestByDevice: jest.fn(),
      findHistoryByDevice: jest.fn(),
      deleteOlderThan: jest.fn()
    };

    logger = makeLogger();
    useCase = new GetWirelessClientsUseCase(snapshotRepo, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('beforeExecute — request validation', () => {
    it('should fail when deviceId is empty', async () => {
      const result = await useCase.execute({ deviceId: '' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should fail when deviceId is whitespace only', async () => {
      const result = await useCase.execute({ deviceId: '   ' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should NOT call snapshotRepo when beforeExecute fails', async () => {
      await useCase.execute({ deviceId: '' });

      expect(snapshotRepo.findLatestByDevice).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — device ID parsing', () => {
    it('should fail when deviceId is not a valid UUID', async () => {
      const result = await useCase.execute({ deviceId: 'not-a-uuid' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });
  });

  // ===========================================================================
  describe('executeImpl — snapshot loading', () => {
    it('should fail when snapshotRepo returns a failure', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(Result.fail('DB timeout'));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load wireless snapshot');
    });

    it('should fail when no snapshot exists for the device', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('No wireless data found for device');
    });
  });

  // ===========================================================================
  describe('executeImpl — CPE device type rejection', () => {
    it('should fail when the device is a CPE', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(Result.ok(makeSnapshot('STATION')));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isFailure).toBe(true);
    });

    it('should include NOT_AP in the error message when device is a CPE', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(Result.ok(makeSnapshot('STATION')));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.error).toContain('NOT_AP');
    });
  });

  // ===========================================================================
  describe('executeImpl — happy path (ACCESS_POINT)', () => {
    it('should return a successful Result when the device is an ACCESS_POINT', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot('ACCESS_POINT'))
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
    });

    it('should include the deviceId in the response', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot('ACCESS_POINT'))
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.deviceId).toBe(VALID_DEVICE_UUID);
    });

    it('should include collectedAt as an ISO string', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot('ACCESS_POINT'))
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.collectedAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should return an empty clients array when snapshot has no clients', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot('ACCESS_POINT', []))
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.clients).toHaveLength(0);
    });

    it('should return the correct number of clients when the snapshot has clients', async () => {
      const clients = [makeClient('AA:BB:CC:DD:EE:FF'), makeClient('11:22:33:44:55:66')];
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot('ACCESS_POINT', clients))
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.clients).toHaveLength(2);
    });

    it('should map client macAddress correctly', async () => {
      const clients = [makeClient('AA:BB:CC:DD:EE:FF')];
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot('ACCESS_POINT', clients))
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.clients[0].macAddress).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should preserve client ordering from the snapshot', async () => {
      const clients = [makeClient('AA:BB:CC:DD:EE:FF'), makeClient('11:22:33:44:55:66')];
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot('ACCESS_POINT', clients))
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.clients[0].macAddress).toBe('AA:BB:CC:DD:EE:FF');
      expect(result.value.clients[1].macAddress).toBe('11:22:33:44:55:66');
    });
  });
});
