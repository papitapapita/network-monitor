// Source: src/application/wireless-monitoring/use-cases/GetHardwareChangesUseCase.ts

import { GetHardwareChangesUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetHardwareChangesUseCase';
import { HardwareChangeAssessor } from '../../../../src/application/wireless-monitoring/services';
import {
  DeviceHardware,
  IDeviceHardwareQuery
} from '../../../../src/application/wireless-monitoring/interfaces';
import { IWirelessSnapshotRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessSnapshotRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  DeviceId,
  SnapshotId
} from '../../../../src/domain/shared/ids';
import { WirelessSnapshot } from '../../../../src/domain/wireless-monitoring';
import { WirelessMetrics } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessMetrics';
import { WirelessMetricsProps } from '../../../../src/domain/wireless-monitoring/props/WirelessMetricsProps';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AP_UUID = '550e8400-e29b-41d4-a716-446655440001';
const CPE_UUID = '550e8400-e29b-41d4-a716-446655440002';
const OTHER_UUID = '550e8400-e29b-41d4-a716-446655440003';
const ROCKET_MODEL_UUID = '550e8400-e29b-41d4-a716-446655440010';
const POWERBEAM_MODEL_UUID = '550e8400-e29b-41d4-a716-446655440011';
const UBIQUITI_UUID = '550e8400-e29b-41d4-a716-446655440020';

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

function makeHardware(
  overrides: Partial<DeviceHardware> = {}
): DeviceHardware {
  return {
    deviceId: AP_UUID,
    name: 'AP Torre Norte',
    macAddress: 'AA:BB:CC:DD:EE:01',
    inInventory: false,
    deviceModelId: ROCKET_MODEL_UUID,
    modelName: 'Rocket 5AC Lite',
    vendorId: UBIQUITI_UUID,
    ...overrides
  };
}

function makeSnapshot(
  deviceUuid: string,
  metrics: Partial<WirelessMetricsProps>
): WirelessSnapshot {
  return WirelessSnapshot.reconstitute(SnapshotId.create(), {
    deviceId: DeviceId.parse(deviceUuid).value,
    deviceType: 'ACCESS_POINT',
    collectedAt: new Date('2026-10-27T12:00:00.000Z'),
    collectionMethod: 'http_api',
    metrics: WirelessMetrics.reconstitute({
      macAddress: null,
      deviceModel: null,
      ...metrics
    } as WirelessMetricsProps),
    clients: [],
    alerts: [],
    remoteApDeviceId: null
  });
}

function makeHardwareQuery(): jest.Mocked<IDeviceHardwareQuery> {
  return {
    findHardware: jest.fn(),
    findPolledHardware: jest.fn().mockResolvedValue(Result.ok([])),
    findDevicesByMac: jest.fn().mockResolvedValue(Result.ok([])),
    findCatalogModels: jest.fn().mockResolvedValue(
      Result.ok([
        {
          id: POWERBEAM_MODEL_UUID,
          model: 'PowerBeam 5AC ISO',
          vendorId: UBIQUITI_UUID
        }
      ])
    )
  };
}

function makeSnapshotRepo(): jest.Mocked<IWirelessSnapshotRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findLatestByDevice: jest.fn(),
    findLatestForAllDevices: jest
      .fn()
      .mockResolvedValue(Result.ok([])),
    findHistoryByDevice: jest.fn(),
    deleteOlderThan: jest.fn()
  };
}

// ---------------------------------------------------------------------------

describe('[WLS-154] GetHardwareChangesUseCase', () => {
  let snapshotRepo: jest.Mocked<IWirelessSnapshotRepository>;
  let hardwareQuery: jest.Mocked<IDeviceHardwareQuery>;
  let useCase: GetHardwareChangesUseCase;

  beforeEach(() => {
    snapshotRepo = makeSnapshotRepo();
    hardwareQuery = makeHardwareQuery();
    const logger = makeLogger();
    useCase = new GetHardwareChangesUseCase(
      snapshotRepo,
      hardwareQuery,
      new HardwareChangeAssessor(hardwareQuery, logger),
      logger
    );
  });

  function polling(
    devices: Array<[DeviceHardware, Partial<WirelessMetricsProps>]>
  ): void {
    hardwareQuery.findPolledHardware.mockResolvedValue(
      Result.ok(devices.map(([h]) => h))
    );
    snapshotRepo.findLatestForAllDevices.mockResolvedValue(
      Result.ok(devices.map(([h, m]) => makeSnapshot(h.deviceId, m)))
    );
  }

  it('should return an empty list when nothing is polled', async () => {
    const result = await useCase.execute();

    expect(result.value).toEqual({ devices: [] });
  });

  it('should leave out radios whose MAC and model match inventory', async () => {
    polling([
      [
        makeHardware(),
        {
          macAddress: 'aa-bb-cc-dd-ee-01',
          deviceModel: 'Rocket 5AC-Lite'
        }
      ]
    ]);

    const result = await useCase.execute();

    expect(result.value.devices).toHaveLength(0);
  });

  it('should list a radio reporting a different model, with its suggestions', async () => {
    polling([
      [
        makeHardware(),
        {
          macAddress: 'AA:BB:CC:DD:EE:01',
          deviceModel: 'PowerBeam 5AC ISO'
        }
      ]
    ]);

    const result = await useCase.execute();

    expect(result.value.devices).toEqual([
      {
        deviceId: AP_UUID,
        name: 'AP Torre Norte',
        collectedAt: '2026-10-27T12:00:00.000Z',
        suggestions: [
          {
            field: 'deviceModel',
            currentValue: ROCKET_MODEL_UUID,
            suggestedValue: POWERBEAM_MODEL_UUID,
            currentLabel: 'Rocket 5AC Lite',
            suggestedLabel: 'PowerBeam 5AC ISO',
            actions: ['REPLACE'],
            swapWith: null
          }
        ]
      }
    ]);
  });

  it('should list a radio reporting a different MAC than the one on file', async () => {
    polling([[makeHardware(), { macAddress: 'AA:BB:CC:DD:EE:99' }]]);

    const result = await useCase.execute();

    expect(result.value.devices[0].suggestions).toEqual([
      expect.objectContaining({
        field: 'macAddress',
        actions: ['REPLACE', 'UPDATE']
      })
    ]);
  });

  it('should not list a radio whose only difference is a MAC missing from inventory', async () => {
    polling([
      [
        makeHardware({ macAddress: null }),
        { macAddress: 'AA:BB:CC:DD:EE:01' }
      ]
    ]);

    const result = await useCase.execute();

    expect(result.value.devices).toHaveLength(0);
  });

  it('should skip polled radios that have no snapshot yet', async () => {
    hardwareQuery.findPolledHardware.mockResolvedValue(
      Result.ok([makeHardware()])
    );

    const result = await useCase.execute();

    expect(result.value.devices).toHaveLength(0);
  });

  it('should pair two radios that traded places as swaps of each other', async () => {
    const cpe = makeHardware({
      deviceId: CPE_UUID,
      name: 'CPE Ana',
      macAddress: 'AA:BB:CC:DD:EE:02'
    });
    polling([
      [makeHardware(), { macAddress: 'AA:BB:CC:DD:EE:02' }],
      [cpe, { macAddress: 'AA:BB:CC:DD:EE:01' }]
    ]);
    hardwareQuery.findDevicesByMac.mockResolvedValue(
      Result.ok([
        {
          deviceId: AP_UUID,
          name: 'AP Torre Norte',
          macAddress: 'AA:BB:CC:DD:EE:01'
        },
        {
          deviceId: CPE_UUID,
          name: 'CPE Ana',
          macAddress: 'AA:BB:CC:DD:EE:02'
        }
      ])
    );

    const result = await useCase.execute();

    expect(
      result.value.devices.map((d) => [
        d.name,
        d.suggestions[0].swapWith
      ])
    ).toEqual([
      ['AP Torre Norte', { deviceId: CPE_UUID, name: 'CPE Ana' }],
      ['CPE Ana', { deviceId: AP_UUID, name: 'AP Torre Norte' }]
    ]);
  });

  it('should look up MAC owners and the catalog once for the whole fleet', async () => {
    polling([
      [
        makeHardware(),
        { macAddress: 'AA:BB:CC:DD:EE:98', deviceModel: 'X' }
      ],
      [
        makeHardware({
          deviceId: OTHER_UUID,
          macAddress: 'AA:BB:CC:DD:EE:03'
        }),
        { macAddress: 'AA:BB:CC:DD:EE:99', deviceModel: 'Y' }
      ]
    ]);

    await useCase.execute();

    expect(hardwareQuery.findDevicesByMac).toHaveBeenCalledTimes(1);
    expect(hardwareQuery.findDevicesByMac).toHaveBeenCalledWith([
      'AA:BB:CC:DD:EE:98',
      'AA:BB:CC:DD:EE:99'
    ]);
    expect(hardwareQuery.findCatalogModels).toHaveBeenCalledTimes(1);
  });

  it('should not read the catalog when no model differs', async () => {
    polling([[makeHardware(), { macAddress: 'AA:BB:CC:DD:EE:99' }]]);

    await useCase.execute();

    expect(hardwareQuery.findCatalogModels).not.toHaveBeenCalled();
  });

  it('should sort the list by device name', async () => {
    polling([
      [
        makeHardware({ deviceId: CPE_UUID, name: 'Zona Sur' }),
        { deviceModel: 'PowerBeam 5AC ISO' }
      ],
      [
        makeHardware({ name: 'Antena Centro' }),
        { deviceModel: 'PowerBeam 5AC ISO' }
      ]
    ]);

    const result = await useCase.execute();

    expect(result.value.devices.map((d) => d.name)).toEqual([
      'Antena Centro',
      'Zona Sur'
    ]);
  });

  it.each([
    ['polled hardware', 'findPolledHardware'],
    ['catalog', 'findCatalogModels']
  ] as const)(
    'should fail when the %s cannot be read',
    async (_, method) => {
      polling([
        [makeHardware(), { deviceModel: 'PowerBeam 5AC ISO' }]
      ]);
      (hardwareQuery[method] as jest.Mock).mockResolvedValue(
        Result.fail('db down')
      );

      const result = await useCase.execute();

      expect(result.isFailure).toBe(true);
    }
  );

  it('should fail when the snapshots cannot be read', async () => {
    snapshotRepo.findLatestForAllDevices.mockResolvedValue(
      Result.fail('db down')
    );

    const result = await useCase.execute();

    expect(result.error).toContain(
      'Failed to load wireless snapshots'
    );
  });
});
