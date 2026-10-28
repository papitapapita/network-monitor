// Source: src/application/device-inventory/use-cases/GetHardwareChangesUseCase.ts

import { GetHardwareChangesUseCase } from '../../../../src/application/device-inventory/use-cases/GetHardwareChangesUseCase';
import { HardwareChangeAssessor } from '../../../../src/application/device-inventory/services';
import {
  DeviceHardware,
  IDeviceHardwareQuery,
  ReportedHardware
} from '../../../../src/application/device-inventory/interfaces';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AP_UUID = '550e8400-e29b-41d4-a716-446655440001';
const CPE_UUID = '550e8400-e29b-41d4-a716-446655440002';
const OTHER_UUID = '550e8400-e29b-41d4-a716-446655440003';
const ROUTER_UUID = '550e8400-e29b-41d4-a716-446655440004';
const ROCKET_MODEL_UUID = '550e8400-e29b-41d4-a716-446655440010';
const POWERBEAM_MODEL_UUID = '550e8400-e29b-41d4-a716-446655440011';
const RB4011_MODEL_UUID = '550e8400-e29b-41d4-a716-446655440012';
const UBIQUITI_UUID = '550e8400-e29b-41d4-a716-446655440020';
const MIKROTIK_UUID = '550e8400-e29b-41d4-a716-446655440021';
const COLLECTED_AT = new Date('2026-10-27T12:00:00.000Z');

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
    serialNumber: null,
    inInventory: false,
    deviceModelId: ROCKET_MODEL_UUID,
    modelName: 'Rocket 5AC Lite',
    vendorId: UBIQUITI_UUID,
    ...overrides
  };
}

function makeRouterHardware(
  overrides: Partial<DeviceHardware> = {}
): DeviceHardware {
  return makeHardware({
    deviceId: ROUTER_UUID,
    name: 'Core-Insetel',
    macAddress: 'DC:2C:6E:00:00:01',
    serialNumber: 'D4440E1A2B3C',
    deviceModelId: RB4011_MODEL_UUID,
    modelName: 'RB4011iGS+',
    vendorId: MIKROTIK_UUID,
    ...overrides
  });
}

interface Reported {
  macAddress?: string | null;
  deviceModel?: string | null;
}

function radio(
  hardware: DeviceHardware,
  reported: Reported
): ReportedHardware {
  return {
    hardware,
    source: 'RADIO',
    reportedAt: COLLECTED_AT,
    macAddress: reported.macAddress ?? null,
    deviceModel: reported.deviceModel ?? null,
    serialNumber: null,
    identity: null
  };
}

function router(
  hardware: DeviceHardware,
  reported: Partial<
    Pick<
      ReportedHardware,
      'macAddress' | 'deviceModel' | 'serialNumber' | 'identity'
    >
  > = {}
): ReportedHardware {
  return {
    hardware,
    source: 'ROUTER',
    reportedAt: COLLECTED_AT,
    macAddress: 'DC:2C:6E:00:00:01',
    deviceModel: 'RB4011iGS+',
    serialNumber: 'D4440E1A2B3C',
    identity: 'Core-Insetel',
    ...reported
  };
}

function makeHardwareQuery(): jest.Mocked<IDeviceHardwareQuery> {
  return {
    findHardware: jest.fn(),
    findReportedHardware: jest.fn().mockResolvedValue(Result.ok([])),
    findDevicesByMac: jest.fn().mockResolvedValue(Result.ok([])),
    findDevicesBySerial: jest.fn().mockResolvedValue(Result.ok([])),
    findConfirmedModelNames: jest
      .fn()
      .mockResolvedValue(Result.ok([])),
    findCatalogModels: jest.fn().mockResolvedValue(
      Result.ok([
        {
          id: POWERBEAM_MODEL_UUID,
          model: 'PowerBeam 5AC ISO',
          vendorId: UBIQUITI_UUID
        },
        {
          id: RB4011_MODEL_UUID,
          model: 'RB4011iGS+',
          vendorId: MIKROTIK_UUID
        }
      ])
    )
  };
}

// ---------------------------------------------------------------------------

describe('[WLS-154] GetHardwareChangesUseCase', () => {
  let hardwareQuery: jest.Mocked<IDeviceHardwareQuery>;
  let useCase: GetHardwareChangesUseCase;

  beforeEach(() => {
    hardwareQuery = makeHardwareQuery();
    const logger = makeLogger();
    useCase = new GetHardwareChangesUseCase(
      hardwareQuery,
      new HardwareChangeAssessor(hardwareQuery, logger),
      logger
    );
  });

  function polling(devices: Array<[DeviceHardware, Reported]>): void {
    reporting(devices.map(([h, m]) => radio(h, m)));
  }

  function reporting(reports: ReportedHardware[]): void {
    hardwareQuery.findReportedHardware.mockResolvedValue(
      Result.ok(reports)
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
        makeHardware({ macAddress: null }),
        { deviceModel: 'PowerBeam 5AC ISO' }
      ]
    ]);

    const result = await useCase.execute();

    expect(result.value.devices).toEqual([
      {
        deviceId: AP_UUID,
        name: 'AP Torre Norte',
        source: 'RADIO',
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

  it('[WLS-155] should read the confirmed model names once for the whole fleet', async () => {
    polling([
      [makeHardware({ macAddress: null }), { deviceModel: 'X' }],
      [
        makeHardware({ deviceId: OTHER_UUID, macAddress: null }),
        { deviceModel: 'Y' }
      ]
    ]);

    await useCase.execute();

    expect(
      hardwareQuery.findConfirmedModelNames
    ).toHaveBeenCalledTimes(1);
  });

  it('[WLS-155] should leave out a radio reporting another model name with the MAC on file', async () => {
    polling([
      [
        makeHardware(),
        {
          macAddress: 'AA:BB:CC:DD:EE:01',
          deviceModel: 'LBE-5AC-Gen2'
        }
      ]
    ]);

    const result = await useCase.execute();

    expect(result.value.devices).toHaveLength(0);
    expect(
      hardwareQuery.findConfirmedModelNames
    ).not.toHaveBeenCalled();
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
    ['reported hardware', 'findReportedHardware'],
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
});

describe('[DEV-215] GetHardwareChangesUseCase — MikroTiks', () => {
  let hardwareQuery: jest.Mocked<IDeviceHardwareQuery>;
  let useCase: GetHardwareChangesUseCase;

  beforeEach(() => {
    hardwareQuery = makeHardwareQuery();
    const logger = makeLogger();
    useCase = new GetHardwareChangesUseCase(
      hardwareQuery,
      new HardwareChangeAssessor(hardwareQuery, logger),
      logger
    );
  });

  const reporting = (reports: ReportedHardware[]) =>
    hardwareQuery.findReportedHardware.mockResolvedValue(
      Result.ok(reports)
    );

  it('[DEV-215] should leave out a router whose serial, model and name match', async () => {
    reporting([router(makeRouterHardware())]);

    const result = await useCase.execute();

    expect(result.value.devices).toEqual([]);
  });

  it('[DEV-215] should list a router reporting another serial, to replace or correct', async () => {
    reporting([
      router(makeRouterHardware(), { serialNumber: 'HG5094Z' })
    ]);

    const result = await useCase.execute();

    expect(result.value.devices).toEqual([
      {
        deviceId: ROUTER_UUID,
        name: 'Core-Insetel',
        source: 'ROUTER',
        collectedAt: '2026-10-27T12:00:00.000Z',
        suggestions: [
          {
            field: 'serialNumber',
            currentValue: 'D4440E1A2B3C',
            suggestedValue: 'HG5094Z',
            currentLabel: null,
            suggestedLabel: null,
            actions: ['REPLACE', 'UPDATE'],
            swapWith: null
          }
        ]
      }
    ]);
  });

  it('[DEV-215] should compare serials without case or spaces', async () => {
    reporting([
      router(makeRouterHardware({ serialNumber: ' d4440e1a2b3c ' }))
    ]);

    const result = await useCase.execute();

    expect(result.value.devices).toEqual([]);
  });

  it('[DEV-215] should not compare the MAC of a router that reports a serial', async () => {
    reporting([
      router(makeRouterHardware(), {
        macAddress: 'DC:2C:6E:00:00:09'
      })
    ]);

    const result = await useCase.execute();

    expect(result.value.devices).toEqual([]);
    expect(hardwareQuery.findDevicesByMac).not.toHaveBeenCalled();
  });

  it('[DEV-215] should compare the MAC of a router without a serial', async () => {
    reporting([
      router(makeRouterHardware(), {
        serialNumber: null,
        macAddress: 'DC:2C:6E:00:00:09'
      })
    ]);

    const result = await useCase.execute();

    expect(result.value.devices[0]!.suggestions).toEqual([
      expect.objectContaining({
        field: 'macAddress',
        suggestedValue: 'DC:2C:6E:00:00:09'
      })
    ]);
  });

  it('[DEV-215] should not list a router whose only difference is a serial missing from inventory', async () => {
    reporting([router(makeRouterHardware({ serialNumber: null }))]);

    const result = await useCase.execute();

    expect(result.value.devices).toEqual([]);
  });

  it('[DEV-216] should offer a swap when the serial belongs to another device', async () => {
    reporting([
      router(makeRouterHardware(), { serialNumber: 'HG5094Z' })
    ]);
    hardwareQuery.findDevicesBySerial.mockResolvedValue(
      Result.ok([
        {
          deviceId: OTHER_UUID,
          name: 'Switch Norte',
          serialNumber: 'hg5094z'
        }
      ])
    );

    const result = await useCase.execute();

    expect(hardwareQuery.findDevicesBySerial).toHaveBeenCalledWith([
      'HG5094Z'
    ]);
    expect(result.value.devices[0]!.suggestions[0]).toMatchObject({
      field: 'serialNumber',
      actions: ['SWAP'],
      swapWith: { deviceId: OTHER_UUID, name: 'Switch Norte' }
    });
  });

  it('[DEV-216] should list a router that names itself differently, to rename in the app', async () => {
    reporting([
      router(makeRouterHardware({ name: 'Core' }), {
        identity: 'Core-Insetel'
      })
    ]);

    const result = await useCase.execute();

    expect(result.value.devices[0]!.suggestions).toEqual([
      {
        field: 'name',
        currentValue: 'Core',
        suggestedValue: 'Core-Insetel',
        currentLabel: null,
        suggestedLabel: null,
        actions: ['UPDATE'],
        swapWith: null
      }
    ]);
  });

  it('[DEV-216] should not call a change of case a different name', async () => {
    reporting([
      router(makeRouterHardware({ name: 'core-insetel ' }), {
        identity: 'CORE-INSETEL'
      })
    ]);

    const result = await useCase.execute();

    expect(result.value.devices).toEqual([]);
  });

  it('[DEV-215] should not call a different model name a change while the serial matches', async () => {
    reporting([
      router(makeRouterHardware(), {
        deviceModel: 'RB4011iGS+5HacQ2HnD'
      })
    ]);

    const result = await useCase.execute();

    expect(result.value.devices).toEqual([]);
  });

  it('[DEV-215] should list radios and routers together, by name', async () => {
    reporting([
      router(makeRouterHardware(), { serialNumber: 'HG5094Z' }),
      radio(makeHardware(), { macAddress: 'AA:BB:CC:DD:EE:99' })
    ]);

    const result = await useCase.execute();

    expect(
      result.value.devices.map((d) => [d.name, d.source])
    ).toEqual([
      ['AP Torre Norte', 'RADIO'],
      ['Core-Insetel', 'ROUTER']
    ]);
  });
});
