// Source: src/application/wireless-monitoring/use-cases/GetWirelessThroughputUseCase.ts

import { GetWirelessThroughputUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetWirelessThroughputUseCase';
import { IWirelessSnapshotRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessSnapshotRepository';
import { IWirelessDeviceConfigRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessDeviceConfigRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  WirelessSnapshot,
  WirelessDeviceConfig
} from '../../../../src/domain/wireless-monitoring';
import { WirelessMetrics } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessMetrics';
import { PollingInterval } from '../../../../src/domain/wireless-monitoring/value-objects/PollingInterval';
import {
  DeviceId,
  SnapshotId,
  WirelessDeviceConfigId
} from '../../../../src/domain/shared/ids';
import { WirelessMetricsProps } from '../../../../src/domain/wireless-monitoring/props';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const SNAPSHOT_UUID = '550e8400-e29b-41d4-a716-446655440002';
const CONFIG_UUID = '550e8400-e29b-41d4-a716-446655440003';

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
    child: jest.fn()
  };
  child.child.mockReturnValue(child);
  return child;
}

function makeMetrics(
  overrides: Partial<WirelessMetricsProps> = {}
): WirelessMetrics {
  return WirelessMetrics.reconstitute({
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
    ssid: null,
    ...overrides
  });
}

function makeSnapshot(): WirelessSnapshot {
  return WirelessSnapshot.reconstitute(
    SnapshotId.parse(SNAPSHOT_UUID).value,
    {
      deviceId: DeviceId.parse(DEVICE_UUID).value,
      deviceType: 'STATION',
      collectedAt: new Date(),
      collectionMethod: 'http_api',
      metrics: makeMetrics({
        throughputTxBps: 8_000_000,
        throughputRxBps: 2_000_000
      }),
      clients: [],
      alerts: [],
      remoteApDeviceId: null
    }
  );
}

function makeConfig(
  linkCapacityKbps: number | null = 50_000
): WirelessDeviceConfig {
  return WirelessDeviceConfig.reconstitute(
    WirelessDeviceConfigId.parse(CONFIG_UUID).value,
    {
      deviceId: DeviceId.parse(DEVICE_UUID).value,
      ipAddress: null,
      enabled: true,
      pollingInterval: PollingInterval.reconstitute(60),
      deviceType: 'STATION',
      linkCapacityKbps,
      clientsProvisionedLimit: null,
      lastPolledAt: null
    }
  );
}

// ---------------------------------------------------------------------------

describe('[WLS-146] GetWirelessThroughputUseCase', () => {
  let snapshotRepo: jest.Mocked<IWirelessSnapshotRepository>;
  let configRepo: jest.Mocked<IWirelessDeviceConfigRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: GetWirelessThroughputUseCase;

  beforeEach(() => {
    snapshotRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findLatestByDevice: jest.fn(),
      findLatestForAllDevices: jest.fn(),
      findHistoryByDevice: jest.fn(),
      deleteOlderThan: jest.fn()
    };

    configRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      findByDeviceId: jest.fn(),
      findAllDue: jest.fn(),
      findAll: jest.fn()
    };

    logger = makeLogger();
    useCase = new GetWirelessThroughputUseCase(
      snapshotRepo,
      configRepo,
      logger
    );
  });

  describe('happy path', () => {
    it('returns the latest reading with utilisation against the plan', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot())
      );
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig(50_000))
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
      expect(result.value.deviceId).toBe(DEVICE_UUID);
      expect(result.value.throughputTotalBps).toBe(10_000_000);
      expect(result.value.utilisationPercent).toBe(20);
      expect(result.value.stale).toBe(false);
    });

    // a snapshot can outlive the configuration that produced it
    it('still returns the reading when the config is gone', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot())
      );
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
      expect(result.value.utilisationPercent).toBeNull();
      expect(result.value.stale).toBe(true);
    });
  });

  describe('[WLS-140] never polled', () => {
    it('fails with the shared no-data message so the route answers 404', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('No wireless data found for device');
      expect(configRepo.findByDeviceId).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('rejects a blank device id', async () => {
      const result = await useCase.execute({ deviceId: '   ' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Device ID is required');
      expect(snapshotRepo.findLatestByDevice).not.toHaveBeenCalled();
    });

    it('rejects a malformed device id', async () => {
      const result = await useCase.execute({ deviceId: 'not-a-uuid' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
      expect(snapshotRepo.findLatestByDevice).not.toHaveBeenCalled();
    });
  });

  describe('repository failures', () => {
    it('surfaces a snapshot lookup failure', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.fail('connection reset')
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Failed to load wireless throughput'
      );
    });

    it('surfaces a config lookup failure', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot())
      );
      configRepo.findByDeviceId.mockResolvedValue(
        Result.fail('connection reset')
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Failed to load wireless configuration'
      );
    });
  });
});
