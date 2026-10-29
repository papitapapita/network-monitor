// Source: src/application/device-inventory/use-cases/ListUpstreamSuggestionsUseCase.ts

import { ListUpstreamSuggestionsUseCase } from '../../../../src/application/device-inventory/use-cases';
import {
  IKnownDeviceLookup,
  IPoweringSwitchQuery,
  IReportedApQuery,
  IRouterNeighborQuery,
  ITopologyQuery,
  TopologyDeviceRow
} from '../../../../src/application/device-inventory/interfaces';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core';

const LOCATION_ID = '550e8400-e29b-41d4-a716-446655440001';

function makeLogger(): ILogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
}

function row(id: string): TopologyDeviceRow {
  return {
    id,
    name: id,
    status: 'ACTIVE',
    category: null,
    ipAddress: null,
    locationId: LOCATION_ID,
    locationName: null,
    upstreamDeviceId: null,
    connectivity: 'UP',
    downSince: null
  };
}

describe('ListUpstreamSuggestionsUseCase', () => {
  let topology: jest.Mocked<ITopologyQuery>;
  let reportedAps: jest.Mocked<IReportedApQuery>;
  let poweringSwitches: jest.Mocked<IPoweringSwitchQuery>;
  let routerNeighbors: jest.Mocked<IRouterNeighborQuery>;
  let knownDevices: jest.Mocked<IKnownDeviceLookup>;
  let useCase: ListUpstreamSuggestionsUseCase;

  beforeEach(() => {
    topology = {
      findAll: jest
        .fn()
        .mockResolvedValue(
          Result.ok([
            row('ap'),
            row('sta'),
            row('sw'),
            row('ap2'),
            row('hex'),
            row('ap3')
          ])
        )
    };
    reportedAps = {
      findReportedAps: jest.fn().mockResolvedValue(
        Result.ok([
          {
            stationId: 'sta',
            apDeviceId: 'ap',
            matchedBy: 'MAC',
            observedAt: null
          }
        ])
      )
    };
    poweringSwitches = {
      findPoweringSwitches: jest.fn().mockResolvedValue(
        Result.ok({
          links: [
            { deviceId: 'ap2', switchDeviceId: 'sw', port: 'ether2' }
          ],
          unreadSwitches: [
            { deviceId: 'sw9', name: 'SW 9', reason: 'x' }
          ]
        })
      )
    };
    routerNeighbors = {
      findRouterNeighbors: jest.fn().mockResolvedValue(
        Result.ok({
          routers: [
            {
              routerDeviceId: 'hex',
              routerName: 'hex',
              ports: [{ name: 'ether3', comment: null }],
              neighbors: [
                {
                  port: 'ether3',
                  macAddress: '24:A4:3C:00:00:03',
                  ipAddress: null,
                  identity: null,
                  platform: null,
                  board: null,
                  version: null,
                  remoteInterface: null
                }
              ]
            }
          ],
          unreadRouters: [
            { deviceId: 'core', name: 'Core', reason: 'timeout' }
          ]
        })
      ),
      findRouterNeighborsOf: jest.fn()
    };
    knownDevices = {
      findOwners: jest.fn().mockResolvedValue(
        Result.ok({
          byMac: new Map([['24:A4:3C:00:00:03', 'ap3']]),
          byIp: new Map()
        })
      )
    };
    useCase = new ListUpstreamSuggestionsUseCase(
      topology,
      reportedAps,
      poweringSwitches,
      routerNeighbors,
      knownDevices,
      makeLogger()
    );
  });

  it('[DEV-190] [DEV-191] [DEV-196] merges every source and reports what was not read', async () => {
    const result = await useCase.execute({});

    expect(result.value.total).toBe(3);
    expect(
      result.value.suggestions.map((s) => [s.deviceId, s.source])
    ).toEqual([
      ['sta', 'WIRELESS'],
      ['ap2', 'POE'],
      ['ap3', 'ROUTER_NEIGHBOR']
    ]);
    expect(result.value.unreadSwitches).toEqual([
      { deviceId: 'sw9', name: 'SW 9', reason: 'x' }
    ]);
    expect(result.value.unreadRouters).toEqual([
      { deviceId: 'core', name: 'Core', reason: 'timeout' }
    ]);
    expect(knownDevices.findOwners).toHaveBeenCalledWith(
      ['24:A4:3C:00:00:03'],
      []
    );
    expect(
      poweringSwitches.findPoweringSwitches
    ).toHaveBeenCalledWith(null);
  });

  it('[DEV-195] narrows the PoE read to the location asked for', async () => {
    await useCase.execute({ locationId: LOCATION_ID });

    expect(
      poweringSwitches.findPoweringSwitches
    ).toHaveBeenCalledWith(LOCATION_ID);
  });

  it('refuses a malformed location id', async () => {
    const result = await useCase.execute({ locationId: 'nope' });

    expect(result.error).toContain('Invalid location ID');
  });

  it('fails when a source cannot be read', async () => {
    reportedAps.findReportedAps.mockResolvedValue(Result.fail('db'));

    const result = await useCase.execute({});

    expect(result.error).toContain('db');
  });

  it('fails when the switches cannot be read', async () => {
    poweringSwitches.findPoweringSwitches.mockResolvedValue(
      Result.fail('db')
    );

    const result = await useCase.execute({});

    expect(result.error).toContain('Failed to read the PoE switches');
  });

  it('fails when the router list cannot be loaded', async () => {
    routerNeighbors.findRouterNeighbors.mockResolvedValue(
      Result.fail('db')
    );

    const result = await useCase.execute({});

    expect(result.error).toContain(
      "Failed to read the routers' neighbours"
    );
  });

  it('fails when the neighbours cannot be matched with inventory', async () => {
    knownDevices.findOwners.mockResolvedValue(Result.fail('db'));

    const result = await useCase.execute({});

    expect(result.error).toContain(
      'Failed to match neighbours with inventory'
    );
  });
});
