// Source: src/application/wireless-monitoring/use-cases/GetDeviceIdentitySuggestionsUseCase.ts

import { GetDeviceIdentitySuggestionsUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetDeviceIdentitySuggestionsUseCase';
import { IWirelessSnapshotRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessSnapshotRepository';
import { IWirelessDeviceConfigRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessDeviceConfigRepository';
import { IDeviceRepository } from '../../../../src/application/wireless-monitoring/interfaces';
import {
  DeviceHardware,
  IDeviceHardwareQuery
} from '../../../../src/application/device-inventory/interfaces';
import { HardwareChangeAssessor } from '../../../../src/application/device-inventory/services';
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
const ROCKET_MODEL_UUID = '550e8400-e29b-41d4-a716-446655440010';
const POWERBEAM_MODEL_UUID = '550e8400-e29b-41d4-a716-446655440011';
const OTHER_VENDOR_POWERBEAM_UUID =
  '550e8400-e29b-41d4-a716-446655440012';
const UBIQUITI_UUID = '550e8400-e29b-41d4-a716-446655440020';
const OTHER_VENDOR_UUID = '550e8400-e29b-41d4-a716-446655440021';

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

function makeHardware(
  overrides: Partial<DeviceHardware> = {}
): DeviceHardware {
  return {
    deviceId: DEVICE_UUID,
    name: 'AP Roof1',
    macAddress: 'AA:BB:CC:DD:EE:01',
    serialNumber: null,
    inInventory: false,
    deviceModelId: ROCKET_MODEL_UUID,
    modelName: 'Rocket 5AC Lite',
    vendorId: UBIQUITI_UUID,
    ...overrides
  };
}

function makeHardwareQuery(): jest.Mocked<IDeviceHardwareQuery> {
  return {
    findHardware: jest
      .fn()
      .mockResolvedValue(Result.ok(makeHardware())),
    findReportedHardware: jest.fn(),
    findDevicesBySerial: jest.fn().mockResolvedValue(Result.ok([])),
    findDevicesByMac: jest.fn().mockResolvedValue(Result.ok([])),
    findConfirmedModelNames: jest
      .fn()
      .mockResolvedValue(Result.ok([])),
    findCatalogModels: jest.fn().mockResolvedValue(
      Result.ok([
        {
          id: ROCKET_MODEL_UUID,
          model: 'Rocket 5AC Lite',
          vendorId: UBIQUITI_UUID
        },
        {
          id: OTHER_VENDOR_POWERBEAM_UUID,
          model: 'PowerBeam 5AC ISO',
          vendorId: OTHER_VENDOR_UUID
        },
        {
          id: POWERBEAM_MODEL_UUID,
          model: 'Powerbeam-5AC ISO',
          vendorId: UBIQUITI_UUID
        }
      ])
    )
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
  let hardwareQuery: jest.Mocked<IDeviceHardwareQuery>;
  let logger: jest.Mocked<ILogger>;
  let useCase: GetDeviceIdentitySuggestionsUseCase;

  beforeEach(() => {
    snapshotRepo = makeSnapshotRepo();
    configRepo = makeConfigRepo();
    deviceRepo = makeDeviceRepo();
    hardwareQuery = makeHardwareQuery();
    logger = makeLogger();
    useCase = new GetDeviceIdentitySuggestionsUseCase(
      snapshotRepo,
      configRepo,
      deviceRepo,
      hardwareQuery,
      new HardwareChangeAssessor(hardwareQuery, logger),
      logger
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
      hardwareQuery.findHardware.mockResolvedValue(Result.ok(null));

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
        suggestedLabel: null,
        actions: ['UPDATE'],
        swapWith: null
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
        suggestedLabel: null,
        actions: ['REPLACE', 'UPDATE'],
        swapWith: null
      });
    });

    it('should suggest the polled MAC when inventory has none on file', async () => {
      hardwareQuery.findHardware.mockResolvedValue(
        Result.ok(makeHardware({ macAddress: null }))
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
        suggestedLabel: null,
        actions: ['UPDATE'],
        swapWith: null
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
  describe('[WLS-152] executeImpl — MAC actions', () => {
    beforeEach(() => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(
          makeSnapshot({
            deviceName: 'AP Roof1',
            macAddress: 'AA:BB:CC:DD:EE:99'
          })
        )
      );
    });

    it('should offer only an update when the device is still in INVENTORY', async () => {
      hardwareQuery.findHardware.mockResolvedValue(
        Result.ok(makeHardware({ inInventory: true }))
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(
        result.value.suggestions.find((s) => s.field === 'macAddress')
          ?.actions
      ).toEqual(['UPDATE']);
    });

    it('should recommend a replacement, then an update, for a device in service', async () => {
      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(
        result.value.suggestions.find((s) => s.field === 'macAddress')
          ?.actions
      ).toEqual(['REPLACE', 'UPDATE']);
    });
  });

  // ===========================================================================
  describe('[WLS-153] executeImpl — swapped with another inventory unit', () => {
    beforeEach(() => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(
          makeSnapshot({
            deviceName: 'AP Roof1',
            macAddress: 'AA:BB:CC:DD:EE:99',
            deviceModel: 'PowerBeam 5AC ISO'
          })
        )
      );
      hardwareQuery.findDevicesByMac.mockResolvedValue(
        Result.ok([
          {
            deviceId: AP_UUID,
            name: 'AP Torre Norte',
            macAddress: 'AA:BB:CC:DD:EE:99'
          }
        ])
      );
    });

    it('should offer only a swap with the unit that owns the reported MAC', async () => {
      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      const swapWith = { deviceId: AP_UUID, name: 'AP Torre Norte' };
      expect(
        result.value.suggestions.find((s) => s.field === 'macAddress')
      ).toMatchObject({ actions: ['SWAP'], swapWith });
      expect(
        result.value.suggestions.find(
          (s) => s.field === 'deviceModel'
        )
      ).toMatchObject({ actions: ['SWAP'], swapWith });
    });

    it('should fall back to replacement when the MAC lookup fails', async () => {
      hardwareQuery.findDevicesByMac.mockResolvedValue(
        Result.fail('db down')
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(
        result.value.suggestions.find((s) => s.field === 'macAddress')
      ).toMatchObject({
        actions: ['REPLACE', 'UPDATE'],
        swapWith: null
      });
    });

    it('should not offer a swap when no other unit owns the MAC', async () => {
      hardwareQuery.findDevicesByMac.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(
        result.value.suggestions.find(
          (s) => s.field === 'deviceModel'
        )
      ).toMatchObject({ actions: ['REPLACE'], swapWith: null });
    });
  });

  // ===========================================================================
  describe('[WLS-152] executeImpl — model comparison', () => {
    function modelSuggestion(
      suggestions: { field: string }[]
    ): unknown {
      return suggestions.find((s) => s.field === 'deviceModel');
    }

    // No MAC in the report, so the same-box rule (WLS-155) stays out of it.
    function reporting(
      deviceModel: string | null,
      macAddress: string | null = null
    ): void {
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok(
          makeSnapshot({
            deviceName: 'AP Roof1',
            macAddress,
            deviceModel
          })
        )
      );
    }

    it('should not suggest when the reported model matches ignoring case, spaces and hyphens', async () => {
      reporting('rocket-5ac  LITE');

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(
        modelSuggestion(result.value.suggestions)
      ).toBeUndefined();
      expect(hardwareQuery.findCatalogModels).not.toHaveBeenCalled();
    });

    it('should not suggest when the poll never reported a model', async () => {
      reporting(null);

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(
        modelSuggestion(result.value.suggestions)
      ).toBeUndefined();
    });

    it('should suggest a replacement with the matching catalog model, preferring the same vendor', async () => {
      reporting('PowerBeam 5AC ISO');

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(modelSuggestion(result.value.suggestions)).toEqual({
        field: 'deviceModel',
        currentValue: ROCKET_MODEL_UUID,
        suggestedValue: POWERBEAM_MODEL_UUID,
        currentLabel: 'Rocket 5AC Lite',
        suggestedLabel: 'Powerbeam-5AC ISO',
        actions: ['REPLACE'],
        swapWith: null
      });
    });

    it('should suggest the reported name with no catalog id when the catalog lacks it', async () => {
      reporting('LiteBeam 5AC Gen2');

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(modelSuggestion(result.value.suggestions)).toEqual({
        field: 'deviceModel',
        currentValue: ROCKET_MODEL_UUID,
        suggestedValue: null,
        currentLabel: 'Rocket 5AC Lite',
        suggestedLabel: 'LiteBeam 5AC Gen2',
        actions: ['REPLACE'],
        swapWith: null
      });
    });

    it('should offer an in-place update while the device is in INVENTORY', async () => {
      reporting('PowerBeam 5AC ISO');
      hardwareQuery.findHardware.mockResolvedValue(
        Result.ok(makeHardware({ inInventory: true }))
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(modelSuggestion(result.value.suggestions)).toMatchObject(
        {
          actions: ['UPDATE'],
          swapWith: null
        }
      );
    });

    it('[WLS-155] should not suggest when the radio reports the MAC on file', async () => {
      reporting('LBE-5AC-Gen2', 'aa-bb-cc-dd-ee-01');

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.value.suggestions).toHaveLength(0);
    });

    it('[WLS-155] should not suggest when another radio confirmed the name for this model', async () => {
      reporting('LBE-5AC-Gen2');
      hardwareQuery.findConfirmedModelNames.mockResolvedValue(
        Result.ok([
          {
            reportedModel: 'lbe 5ac gen2',
            deviceModelId: ROCKET_MODEL_UUID
          }
        ])
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(
        modelSuggestion(result.value.suggestions)
      ).toBeUndefined();
    });

    it('[WLS-155] should suggest the confirmed catalog model when the name matches none', async () => {
      reporting('PBE-5AC-ISO');
      hardwareQuery.findConfirmedModelNames.mockResolvedValue(
        Result.ok([
          {
            reportedModel: 'PBE-5AC-ISO',
            deviceModelId: POWERBEAM_MODEL_UUID
          }
        ])
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(modelSuggestion(result.value.suggestions)).toMatchObject(
        {
          suggestedValue: POWERBEAM_MODEL_UUID,
          suggestedLabel: 'Powerbeam-5AC ISO',
          actions: ['REPLACE']
        }
      );
    });

    it('[WLS-155] should leave the catalog id empty when the name was confirmed for several models', async () => {
      reporting('PBE-5AC-ISO');
      hardwareQuery.findConfirmedModelNames.mockResolvedValue(
        Result.ok([
          {
            reportedModel: 'PBE-5AC-ISO',
            deviceModelId: POWERBEAM_MODEL_UUID
          },
          {
            reportedModel: 'PBE-5AC-ISO',
            deviceModelId: OTHER_VENDOR_POWERBEAM_UUID
          }
        ])
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(modelSuggestion(result.value.suggestions)).toMatchObject(
        {
          suggestedValue: null,
          suggestedLabel: 'PBE-5AC-ISO'
        }
      );
    });

    it('[WLS-155] should still suggest, not fail, when the confirmations cannot be read', async () => {
      reporting('LBE-5AC-Gen2');
      hardwareQuery.findConfirmedModelNames.mockResolvedValue(
        Result.fail('db down')
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
      expect(modelSuggestion(result.value.suggestions)).toBeDefined();
    });

    it('should fail when the catalog cannot be read', async () => {
      reporting('PowerBeam 5AC ISO');
      hardwareQuery.findCatalogModels.mockResolvedValue(
        Result.fail('db down')
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.isFailure).toBe(true);
    });

    it('should fail when the device hardware cannot be read', async () => {
      hardwareQuery.findHardware.mockResolvedValue(
        Result.fail('db down')
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.isFailure).toBe(true);
    });
  });

  // ===========================================================================
  describe('executeImpl — combined mismatch', () => {
    it('should report both fields when both differ', async () => {
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
        suggestedLabel: 'AP Torre Sur',
        actions: ['UPDATE'],
        swapWith: null
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
        suggestedLabel: 'AP Torre Norte',
        actions: ['UPDATE'],
        swapWith: null
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
