// Source: src/application/wireless-monitoring/use-cases/GetDeviceIdentitySuggestionsUseCase.ts

import { GetDeviceIdentitySuggestionsUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetDeviceIdentitySuggestionsUseCase';
import { IWirelessSnapshotRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessSnapshotRepository';
import { IWirelessDeviceConfigRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessDeviceConfigRepository';
import { IDeviceRepository } from '../../../../src/application/wireless-monitoring/interfaces';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  DeviceId,
  SnapshotId,
  WirelessDeviceConfigId
} from '../../../../src/domain/shared/ids';
import { WirelessDeviceConfig } from '../../../../src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig';
import { PollingInterval } from '../../../../src/domain/wireless-monitoring/value-objects/PollingInterval';
import { WirelessSnapshot } from '../../../../src/domain/wireless-monitoring';
import { WirelessMetrics } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessMetrics';
import { WirelessMetricsProps } from '../../../../src/domain/wireless-monitoring/props/WirelessMetricsProps';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const SNAPSHOT_UUID = '550e8400-e29b-41d4-a716-446655440002';
const AP_UUID = '550e8400-e29b-41d4-a716-446655440003';
const OTHER_AP_UUID = '550e8400-e29b-41d4-a716-446655440004';

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

function makeConfigRepo(): jest.Mocked<IWirelessDeviceConfigRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    findByDeviceId: jest.fn().mockResolvedValue(Result.ok(null)),
    findAllDue: jest.fn(),
    findStationsBelow: jest.fn(),
    findAll: jest.fn()
  };
}

function makeStationConfig(): WirelessDeviceConfig {
  return WirelessDeviceConfig.reconstitute(
    WirelessDeviceConfigId.create(),
    {
      deviceId: DeviceId.parse(DEVICE_UUID).value,
      ipAddress: null,
      enabled: true,
      pollingInterval: PollingInterval.reconstitute(3600),
      deviceType: 'STATION',
      linkCapacityKbps: null,
      clientsProvisionedLimit: null,
      provisionedLanSpeedMbps: null,
      parentApMismatchPolls: 0,
      lastPolledAt: null
    }
  );
}

function makeDeviceRepo(): jest.Mocked<IDeviceRepository> {
  return {
    findIdByMacAddress: jest.fn(),
    findIdByIpAddress: jest.fn().mockResolvedValue(Result.ok(null)),
    findBasicInfoById: jest.fn(),
    findWirelessIneligibilityReason: jest.fn(),
    findUpstreamId: jest.fn().mockResolvedValue(Result.ok(null)),
    declareUpstreamIfUnset: jest.fn()
  };
}

const NULL_METRICS_PROPS: WirelessMetricsProps = {
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
};

function makeMetrics(
  overrides: Partial<WirelessMetricsProps> = {}
): WirelessMetrics {
  return WirelessMetrics.reconstitute({
    ...NULL_METRICS_PROPS,
    ...overrides
  });
}

function makeSnapshot(
  overrides: Partial<WirelessMetricsProps> = {},
  remoteApUuid: string | null = null
): WirelessSnapshot {
  return WirelessSnapshot.reconstitute(
    SnapshotId.parse(SNAPSHOT_UUID).value,
    {
      deviceId: DeviceId.parse(DEVICE_UUID).value,
      deviceType: 'ACCESS_POINT',
      collectedAt: new Date('2024-01-01T00:00:00.000Z'),
      collectionMethod: 'http_api',
      metrics: makeMetrics(overrides),
      clients: [],
      alerts: [],
      remoteApDeviceId: remoteApUuid
        ? DeviceId.parse(remoteApUuid).value
        : null
    }
  );
}

// ---------------------------------------------------------------------------

describe('GetDeviceIdentitySuggestionsUseCase', () => {
  let snapshotRepo: jest.Mocked<IWirelessSnapshotRepository>;
  let configRepo: jest.Mocked<IWirelessDeviceConfigRepository>;
  let deviceRepo: jest.Mocked<IDeviceRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: GetDeviceIdentitySuggestionsUseCase;

  beforeEach(() => {
    snapshotRepo = makeSnapshotRepo();
    configRepo = makeConfigRepo();
    deviceRepo = makeDeviceRepo();
    logger = makeLogger();
    useCase = new GetDeviceIdentitySuggestionsUseCase(
      snapshotRepo,
      configRepo,
      deviceRepo,
      logger
    );

    deviceRepo.findBasicInfoById.mockResolvedValue(
      Result.ok({ name: 'AP Roof1', macAddress: 'AA:BB:CC:DD:EE:01' })
    );
    snapshotRepo.findLatestByDevice.mockResolvedValue(
      Result.ok(
        makeSnapshot({
          deviceName: 'AP Roof1',
          macAddress: 'AA:BB:CC:DD:EE:01'
        })
      )
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
  describe('executeImpl — device ID parsing and lookup', () => {
    it('should fail when deviceId is not a valid UUID', async () => {
      const result = await useCase.execute({
        deviceId: 'not-a-uuid'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });

    it('should fail when the device does not exist', async () => {
      deviceRepo.findBasicInfoById.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({
        deviceId: DEVICE_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device not found');
    });
  });

  // ===========================================================================
  describe('executeImpl — never polled', () => {
    it('should return polled: false with no suggestions when there is no snapshot', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(null)
      );

      const result = await useCase.execute({
        deviceId: DEVICE_UUID
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.polled).toBe(false);
      expect(result.value.collectedAt).toBeNull();
      expect(result.value.suggestions).toHaveLength(0);
    });
  });

  // ===========================================================================
  describe('[WLS-164] executeImpl — name comparison', () => {
    it('should not suggest when the polled name matches exactly', async () => {
      const result = await useCase.execute({
        deviceId: DEVICE_UUID
      });

      expect(
        result.value.suggestions.find((s) => s.field === 'name')
      ).toBeUndefined();
    });

    it('should not suggest when the only difference is case or surrounding whitespace', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(
          makeSnapshot({
            deviceName: '  ap roof1  ',
            macAddress: 'AA:BB:CC:DD:EE:01'
          })
        )
      );

      const result = await useCase.execute({
        deviceId: DEVICE_UUID
      });

      expect(
        result.value.suggestions.find((s) => s.field === 'name')
      ).toBeUndefined();
    });

    it('should suggest the polled name when it genuinely differs', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(
          makeSnapshot({
            deviceName: 'AP Roof2',
            macAddress: 'AA:BB:CC:DD:EE:01'
          })
        )
      );

      const result = await useCase.execute({
        deviceId: DEVICE_UUID
      });

      const suggestion = result.value.suggestions.find(
        (s) => s.field === 'name'
      );
      expect(suggestion).toEqual({
        field: 'name',
        currentValue: 'AP Roof1',
        suggestedValue: 'AP Roof2',
        currentLabel: null,
        suggestedLabel: null
      });
    });

    it('should not suggest a name when the poll never reported one', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(
          makeSnapshot({
            deviceName: null,
            macAddress: 'AA:BB:CC:DD:EE:01'
          })
        )
      );

      const result = await useCase.execute({
        deviceId: DEVICE_UUID
      });

      expect(
        result.value.suggestions.find((s) => s.field === 'name')
      ).toBeUndefined();
    });
  });

  // ===========================================================================
  describe('[WLS-164] executeImpl — MAC comparison', () => {
    it('should not suggest when the polled MAC matches after normalization', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(
          makeSnapshot({
            deviceName: 'AP Roof1',
            macAddress: 'aa-bb-cc-dd-ee-01'
          })
        )
      );

      const result = await useCase.execute({
        deviceId: DEVICE_UUID
      });

      expect(
        result.value.suggestions.find((s) => s.field === 'macAddress')
      ).toBeUndefined();
    });

    it('should suggest the polled MAC when it genuinely differs', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(
          makeSnapshot({
            deviceName: 'AP Roof1',
            macAddress: 'AA:BB:CC:DD:EE:99'
          })
        )
      );

      const result = await useCase.execute({
        deviceId: DEVICE_UUID
      });

      const suggestion = result.value.suggestions.find(
        (s) => s.field === 'macAddress'
      );
      expect(suggestion).toEqual({
        field: 'macAddress',
        currentValue: 'AA:BB:CC:DD:EE:01',
        suggestedValue: 'AA:BB:CC:DD:EE:99',
        currentLabel: null,
        suggestedLabel: null
      });
    });

    it('should suggest the polled MAC when inventory has none on file', async () => {
      deviceRepo.findBasicInfoById.mockResolvedValue(
        Result.ok({ name: 'AP Roof1', macAddress: null })
      );

      const result = await useCase.execute({
        deviceId: DEVICE_UUID
      });

      const suggestion = result.value.suggestions.find(
        (s) => s.field === 'macAddress'
      );
      expect(suggestion).toEqual({
        field: 'macAddress',
        currentValue: null,
        suggestedValue: 'AA:BB:CC:DD:EE:01',
        currentLabel: null,
        suggestedLabel: null
      });
    });

    it('should not suggest a MAC when the poll never reported one', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(
          makeSnapshot({
            deviceName: 'AP Roof1',
            macAddress: null
          })
        )
      );

      const result = await useCase.execute({
        deviceId: DEVICE_UUID
      });

      expect(
        result.value.suggestions.find((s) => s.field === 'macAddress')
      ).toBeUndefined();
    });
  });

  // ===========================================================================
  describe('executeImpl — combined mismatch', () => {
    it('should report both fields when both differ', async () => {
      deviceRepo.findBasicInfoById.mockResolvedValue(
        Result.ok({
          name: 'AP Roof1',
          macAddress: 'AA:BB:CC:DD:EE:01'
        })
      );
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(
          makeSnapshot({
            deviceName: 'AP Roof2',
            macAddress: 'AA:BB:CC:DD:EE:99'
          })
        )
      );

      const result = await useCase.execute({
        deviceId: DEVICE_UUID
      });

      expect(result.value.suggestions).toHaveLength(2);
      expect(result.value.polled).toBe(true);
      expect(result.value.collectedAt).toBe(
        new Date('2024-01-01T00:00:00.000Z').toISOString()
      );
    });
  });

  // ===========================================================================
  describe('[WLS-151] executeImpl — parent AP', () => {
    const names: Record<string, string> = {
      [DEVICE_UUID]: 'CPE Juan',
      [AP_UUID]: 'AP Torre Norte',
      [OTHER_AP_UUID]: 'AP Torre Sur'
    };

    beforeEach(() => {
      deviceRepo.findBasicInfoById.mockImplementation(async (id) =>
        Result.ok(
          names[id.toString()]
            ? { name: names[id.toString()], macAddress: null }
            : null
        )
      );
    });

    function parentApSuggestion(
      suggestions: { field: string }[]
    ): unknown {
      return suggestions.find((s) => s.field === 'upstreamDeviceId');
    }

    it('should suggest the reported AP when it differs from the declared one', async () => {
      deviceRepo.findUpstreamId.mockResolvedValue(
        Result.ok(DeviceId.parse(AP_UUID).value)
      );
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeStationConfig())
      );
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot({}, OTHER_AP_UUID))
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(parentApSuggestion(result.value.suggestions)).toEqual({
        field: 'upstreamDeviceId',
        currentValue: AP_UUID,
        suggestedValue: OTHER_AP_UUID,
        currentLabel: 'AP Torre Norte',
        suggestedLabel: 'AP Torre Sur'
      });
    });

    it('should not suggest when the reported AP is the declared one', async () => {
      deviceRepo.findUpstreamId.mockResolvedValue(
        Result.ok(DeviceId.parse(AP_UUID).value)
      );
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeStationConfig())
      );
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot({}, AP_UUID))
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(
        parentApSuggestion(result.value.suggestions)
      ).toBeUndefined();
    });

    it('should suggest an AP found only by its reported IP', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeStationConfig())
      );
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot({ remoteApIp: '10.0.0.2' }))
      );
      deviceRepo.findIdByIpAddress.mockResolvedValue(
        Result.ok(DeviceId.parse(AP_UUID).value)
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(deviceRepo.findIdByIpAddress).toHaveBeenCalledWith(
        '10.0.0.2'
      );
      expect(parentApSuggestion(result.value.suggestions)).toEqual({
        field: 'upstreamDeviceId',
        currentValue: null,
        suggestedValue: AP_UUID,
        currentLabel: null,
        suggestedLabel: 'AP Torre Norte'
      });
    });

    it('should prefer the MAC match over the IP match', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeStationConfig())
      );
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot({ remoteApIp: '10.0.0.2' }, AP_UUID))
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(deviceRepo.findIdByIpAddress).not.toHaveBeenCalled();
      expect(
        parentApSuggestion(result.value.suggestions)
      ).toMatchObject({
        suggestedValue: AP_UUID
      });
    });

    it('should not suggest when no inventory device matches the reported AP', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeStationConfig())
      );
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot({ remoteApIp: '10.0.0.2' }))
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(
        parentApSuggestion(result.value.suggestions)
      ).toBeUndefined();
    });

    it('should not suggest the device itself as its own AP', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeStationConfig())
      );
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot({ remoteApIp: '10.0.0.2' }))
      );
      deviceRepo.findIdByIpAddress.mockResolvedValue(
        Result.ok(DeviceId.parse(DEVICE_UUID).value)
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(
        parentApSuggestion(result.value.suggestions)
      ).toBeUndefined();
    });

    it('should not suggest an AP that no longer exists in inventory', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeStationConfig())
      );
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(
          makeSnapshot({}, '550e8400-e29b-41d4-a716-446655440099')
        )
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(
        parentApSuggestion(result.value.suggestions)
      ).toBeUndefined();
    });

    it('should not suggest a parent AP without a STATION config', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot({}, AP_UUID))
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(
        parentApSuggestion(result.value.suggestions)
      ).toBeUndefined();
    });

    it('should skip the AP suggestion, not fail, when the IP lookup errors', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeStationConfig())
      );
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(makeSnapshot({ remoteApIp: '10.0.0.2' }))
      );
      deviceRepo.findIdByIpAddress.mockResolvedValue(
        Result.fail('db down')
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
      expect(
        parentApSuggestion(result.value.suggestions)
      ).toBeUndefined();
    });
  });
});
