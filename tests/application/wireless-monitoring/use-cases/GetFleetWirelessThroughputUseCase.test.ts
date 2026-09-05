// Source: src/application/wireless-monitoring/use-cases/GetFleetWirelessThroughputUseCase.ts

import { GetFleetWirelessThroughputUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetFleetWirelessThroughputUseCase';
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

const DEVICE_A = '550e8400-e29b-41d4-a716-446655440001';
const DEVICE_B = '550e8400-e29b-41d4-a716-446655440002';
const SNAPSHOT_A = '550e8400-e29b-41d4-a716-44665544000a';
const SNAPSHOT_B = '550e8400-e29b-41d4-a716-44665544000b';
const CONFIG_A = '550e8400-e29b-41d4-a716-44665544000c';
const CONFIG_B = '550e8400-e29b-41d4-a716-44665544000d';

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

function makeSnapshot(
  snapshotId: string,
  deviceId: string,
  txBps: number
): WirelessSnapshot {
  return WirelessSnapshot.reconstitute(
    SnapshotId.parse(snapshotId).value,
    {
      deviceId: DeviceId.parse(deviceId).value,
      deviceType: 'STATION',
      collectedAt: new Date(),
      collectionMethod: 'http_api',
      metrics: makeMetrics({
        throughputTxBps: txBps,
        throughputRxBps: 0
      }),
      clients: [],
      alerts: [],
      remoteApDeviceId: null
    }
  );
}

function makeConfig(
  configId: string,
  deviceId: string,
  linkCapacityKbps: number | null
): WirelessDeviceConfig {
  return WirelessDeviceConfig.reconstitute(
    WirelessDeviceConfigId.parse(configId).value,
    {
      deviceId: DeviceId.parse(deviceId).value,
      ipAddress: null,
      enabled: true,
      pollingInterval: PollingInterval.reconstitute(60),
      deviceType: 'STATION',
      linkCapacityKbps,
      clientsProvisionedLimit: null,
      provisionedLanSpeedMbps: null,
      parentApDeviceId: null,
      lastPolledAt: null
    }
  );
}

// ---------------------------------------------------------------------------

describe('[WLS-146] GetFleetWirelessThroughputUseCase', () => {
  let snapshotRepo: jest.Mocked<IWirelessSnapshotRepository>;
  let configRepo: jest.Mocked<IWirelessDeviceConfigRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: GetFleetWirelessThroughputUseCase;

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
      findByParentApDeviceId: jest.fn(),
      findAll: jest.fn()
    };

    logger = makeLogger();
    useCase = new GetFleetWirelessThroughputUseCase(
      snapshotRepo,
      configRepo,
      logger
    );
  });

  it('joins each device reading to its own configured capacity', async () => {
    snapshotRepo.findLatestForAllDevices.mockResolvedValue(
      Result.ok([
        makeSnapshot(SNAPSHOT_A, DEVICE_A, 5_000_000),
        makeSnapshot(SNAPSHOT_B, DEVICE_B, 5_000_000)
      ])
    );
    configRepo.findAll.mockResolvedValue(
      Result.ok([
        makeConfig(CONFIG_A, DEVICE_A, 10_000),
        makeConfig(CONFIG_B, DEVICE_B, 50_000)
      ])
    );

    const result = await useCase.execute();

    expect(result.isSuccess).toBe(true);
    expect(result.value.total).toBe(2);

    const byDevice = new Map(
      result.value.devices.map((d) => [d.deviceId, d])
    );
    expect(byDevice.get(DEVICE_A)!.utilisationPercent).toBe(50);
    expect(byDevice.get(DEVICE_B)!.utilisationPercent).toBe(10);
  });

  it('includes a device whose configuration is missing, marked stale', async () => {
    snapshotRepo.findLatestForAllDevices.mockResolvedValue(
      Result.ok([makeSnapshot(SNAPSHOT_A, DEVICE_A, 1_000_000)])
    );
    configRepo.findAll.mockResolvedValue(Result.ok([]));

    const result = await useCase.execute();

    expect(result.isSuccess).toBe(true);
    expect(result.value.total).toBe(1);
    expect(result.value.devices[0].linkCapacityKbps).toBeNull();
    expect(result.value.devices[0].utilisationPercent).toBeNull();
    expect(result.value.devices[0].stale).toBe(true);
  });

  // a config without a snapshot has nothing to report, so it is absent
  it('omits configured devices that have never been polled', async () => {
    snapshotRepo.findLatestForAllDevices.mockResolvedValue(
      Result.ok([makeSnapshot(SNAPSHOT_A, DEVICE_A, 1_000_000)])
    );
    configRepo.findAll.mockResolvedValue(
      Result.ok([
        makeConfig(CONFIG_A, DEVICE_A, 10_000),
        makeConfig(CONFIG_B, DEVICE_B, 10_000)
      ])
    );

    const result = await useCase.execute();

    expect(result.value.total).toBe(1);
    expect(result.value.devices[0].deviceId).toBe(DEVICE_A);
  });

  it('returns an empty fleet rather than failing', async () => {
    snapshotRepo.findLatestForAllDevices.mockResolvedValue(
      Result.ok([])
    );
    configRepo.findAll.mockResolvedValue(Result.ok([]));

    const result = await useCase.execute();

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({ devices: [], total: 0 });
  });

  describe('repository failures', () => {
    it('surfaces a snapshot lookup failure', async () => {
      snapshotRepo.findLatestForAllDevices.mockResolvedValue(
        Result.fail('connection reset')
      );

      const result = await useCase.execute();

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Failed to load fleet throughput'
      );
      expect(configRepo.findAll).not.toHaveBeenCalled();
    });

    it('surfaces a config lookup failure', async () => {
      snapshotRepo.findLatestForAllDevices.mockResolvedValue(
        Result.ok([makeSnapshot(SNAPSHOT_A, DEVICE_A, 1)])
      );
      configRepo.findAll.mockResolvedValue(
        Result.fail('connection reset')
      );

      const result = await useCase.execute();

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Failed to load wireless configurations'
      );
    });
  });
});
