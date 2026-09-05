// Source: src/application/wireless-monitoring/use-cases/GetApExpectedClientsUseCase.ts

import { GetApExpectedClientsUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetApExpectedClientsUseCase';
import { IWirelessDeviceConfigRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessDeviceConfigRepository';
import { IWirelessSnapshotRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessSnapshotRepository';
import { IDeviceRepository } from '../../../../src/application/wireless-monitoring/interfaces';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  DeviceId,
  SnapshotId,
  WirelessDeviceConfigId
} from '../../../../src/domain/shared/ids';
import { PollingInterval } from '../../../../src/domain/wireless-monitoring/value-objects/PollingInterval';
import { WirelessDeviceConfig } from '../../../../src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig';
import { WirelessSnapshot } from '../../../../src/domain/wireless-monitoring';
import { WirelessMetrics } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessMetrics';
import { WirelessClientEntry } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessClientEntry';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AP_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const SNAPSHOT_UUID = '550e8400-e29b-41d4-a716-446655440002';
const CPE_A_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440003';
const CPE_B_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440004';

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

function makeConfigRepo(): jest.Mocked<IWirelessDeviceConfigRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    findByDeviceId: jest.fn(),
    findAllDue: jest.fn(),
    findByParentApDeviceId: jest.fn(),
    findAll: jest.fn()
  };
}

function makeSnapshotRepo(): jest.Mocked<IWirelessSnapshotRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findLatestByDevice: jest.fn(),
    findLatestForAllDevices: jest.fn(),
    findHistoryByDevice: jest.fn(),
    deleteOlderThan: jest.fn()
  };
}

function makeDeviceRepo(): jest.Mocked<IDeviceRepository> {
  return {
    findIdByMacAddress: jest.fn(),
    findBasicInfoById: jest.fn(),
    findWirelessIneligibilityReason: jest.fn()
  };
}

function makeConfig(
  deviceId: string,
  deviceType: 'STATION' | 'ACCESS_POINT'
): WirelessDeviceConfig {
  return WirelessDeviceConfig.reconstitute(
    WirelessDeviceConfigId.create(),
    {
      deviceId: DeviceId.parse(deviceId).value,
      ipAddress: null,
      enabled: true,
      pollingInterval: PollingInterval.reconstitute(3600),
      deviceType,
      linkCapacityKbps: null,
      clientsProvisionedLimit: null,
      provisionedLanSpeedMbps: null,
      parentApDeviceId:
        deviceType === 'STATION'
          ? DeviceId.parse(AP_DEVICE_UUID).value
          : null,
      lastPolledAt: null
    }
  );
}

function makeNullMetrics(): WirelessMetrics {
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
    ssid: null
  });
}

function makeSnapshot(
  clients: WirelessClientEntry[] = []
): WirelessSnapshot {
  return WirelessSnapshot.reconstitute(
    SnapshotId.parse(SNAPSHOT_UUID).value,
    {
      deviceId: DeviceId.parse(AP_DEVICE_UUID).value,
      deviceType: 'ACCESS_POINT',
      collectedAt: new Date('2024-01-01T00:00:00.000Z'),
      collectionMethod: 'http_api',
      metrics: makeNullMetrics(),
      clients,
      alerts: [],
      remoteApDeviceId: null
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
    ulAirtimePercent: null
  });
}

// ---------------------------------------------------------------------------

describe('GetApExpectedClientsUseCase', () => {
  let configRepo: jest.Mocked<IWirelessDeviceConfigRepository>;
  let snapshotRepo: jest.Mocked<IWirelessSnapshotRepository>;
  let deviceRepo: jest.Mocked<IDeviceRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: GetApExpectedClientsUseCase;

  beforeEach(() => {
    configRepo = makeConfigRepo();
    snapshotRepo = makeSnapshotRepo();
    deviceRepo = makeDeviceRepo();
    logger = makeLogger();
    useCase = new GetApExpectedClientsUseCase(
      configRepo,
      snapshotRepo,
      deviceRepo,
      logger
    );

    configRepo.findByDeviceId.mockResolvedValue(
      Result.ok(makeConfig(AP_DEVICE_UUID, 'ACCESS_POINT'))
    );
    configRepo.findByParentApDeviceId.mockResolvedValue(
      Result.ok([])
    );
    snapshotRepo.findLatestByDevice.mockResolvedValue(
      Result.ok(makeSnapshot())
    );
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
  });

  // ===========================================================================
  describe('executeImpl — device ID parsing and config loading', () => {
    it('should fail when deviceId is not a valid UUID', async () => {
      const result = await useCase.execute({
        deviceId: 'not-a-uuid'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });

    it('should fail when no wireless config exists for the device', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({
        deviceId: AP_DEVICE_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'No wireless polling configuration found for device'
      );
    });

    it('should fail with NOT_AP when the device is a STATION', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig(CPE_A_DEVICE_UUID, 'STATION'))
      );

      const result = await useCase.execute({
        deviceId: CPE_A_DEVICE_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('NOT_AP');
    });
  });

  // ===========================================================================
  describe('executeImpl — never-polled AP', () => {
    it('should return collectedAt null and every expected CPE as not connected', async () => {
      configRepo.findByParentApDeviceId.mockResolvedValue(
        Result.ok([makeConfig(CPE_A_DEVICE_UUID, 'STATION')])
      );
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(null)
      );
      deviceRepo.findBasicInfoById.mockResolvedValue(
        Result.ok({ name: 'CPE A', macAddress: 'AA:BB:CC:DD:EE:01' })
      );

      const result = await useCase.execute({
        deviceId: AP_DEVICE_UUID
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.collectedAt).toBeNull();
      expect(result.value.expected).toHaveLength(1);
      expect(result.value.expected[0].connected).toBe(false);
      expect(result.value.missingCount).toBe(1);
    });
  });

  // ===========================================================================
  describe('executeImpl — matching, missing, and unexpected clients', () => {
    it('should mark an expected CPE as connected when its MAC is live', async () => {
      configRepo.findByParentApDeviceId.mockResolvedValue(
        Result.ok([makeConfig(CPE_A_DEVICE_UUID, 'STATION')])
      );
      deviceRepo.findBasicInfoById.mockResolvedValue(
        Result.ok({ name: 'CPE A', macAddress: 'AA:BB:CC:DD:EE:01' })
      );
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot([makeClient('AA:BB:CC:DD:EE:01')]))
      );

      const result = await useCase.execute({
        deviceId: AP_DEVICE_UUID
      });

      expect(result.value.expected[0].connected).toBe(true);
      expect(result.value.expected[0].client?.macAddress).toBe(
        'AA:BB:CC:DD:EE:01'
      );
      expect(result.value.missingCount).toBe(0);
      expect(result.value.unexpectedConnected).toHaveLength(0);
    });

    it('should mark an expected CPE as missing when its MAC is not live', async () => {
      configRepo.findByParentApDeviceId.mockResolvedValue(
        Result.ok([makeConfig(CPE_A_DEVICE_UUID, 'STATION')])
      );
      deviceRepo.findBasicInfoById.mockResolvedValue(
        Result.ok({ name: 'CPE A', macAddress: 'AA:BB:CC:DD:EE:01' })
      );
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot([]))
      );

      const result = await useCase.execute({
        deviceId: AP_DEVICE_UUID
      });

      expect(result.value.expected[0].connected).toBe(false);
      expect(result.value.expected[0].client).toBeNull();
      expect(result.value.missingCount).toBe(1);
    });

    it('should list a live client matching no expected CPE as unexpectedConnected', async () => {
      configRepo.findByParentApDeviceId.mockResolvedValue(
        Result.ok([])
      );
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot([makeClient('11:22:33:44:55:66')]))
      );

      const result = await useCase.execute({
        deviceId: AP_DEVICE_UUID
      });

      expect(result.value.unexpectedConnected).toHaveLength(1);
      expect(result.value.unexpectedConnected[0].macAddress).toBe(
        '11:22:33:44:55:66'
      );
    });

    it('should handle a mix of matched, missing, and unexpected clients', async () => {
      configRepo.findByParentApDeviceId.mockResolvedValue(
        Result.ok([
          makeConfig(CPE_A_DEVICE_UUID, 'STATION'),
          makeConfig(CPE_B_DEVICE_UUID, 'STATION')
        ])
      );
      deviceRepo.findBasicInfoById.mockImplementation((id) => {
        if (id.toString() === CPE_A_DEVICE_UUID) {
          return Promise.resolve(
            Result.ok({
              name: 'CPE A',
              macAddress: 'AA:BB:CC:DD:EE:01'
            })
          );
        }
        return Promise.resolve(
          Result.ok({ name: 'CPE B', macAddress: 'AA:BB:CC:DD:EE:02' })
        );
      });
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(
          makeSnapshot([
            makeClient('AA:BB:CC:DD:EE:01'),
            makeClient('11:22:33:44:55:66')
          ])
        )
      );

      const result = await useCase.execute({
        deviceId: AP_DEVICE_UUID
      });

      const byId = (id: string) =>
        result.value.expected.find((e) => e.deviceId === id);

      expect(byId(CPE_A_DEVICE_UUID)?.connected).toBe(true);
      expect(byId(CPE_B_DEVICE_UUID)?.connected).toBe(false);
      expect(result.value.missingCount).toBe(1);
      expect(result.value.unexpectedConnected).toHaveLength(1);
      expect(result.value.unexpectedConnected[0].macAddress).toBe(
        '11:22:33:44:55:66'
      );
    });

    it('should report connected: false with a null macAddress when the device has no MAC on file', async () => {
      configRepo.findByParentApDeviceId.mockResolvedValue(
        Result.ok([makeConfig(CPE_A_DEVICE_UUID, 'STATION')])
      );
      deviceRepo.findBasicInfoById.mockResolvedValue(
        Result.ok({ name: 'CPE A', macAddress: null })
      );
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot([]))
      );

      const result = await useCase.execute({
        deviceId: AP_DEVICE_UUID
      });

      expect(result.value.expected[0].macAddress).toBeNull();
      expect(result.value.expected[0].connected).toBe(false);
    });
  });
});
