// Source: src/application/device-inventory/use-cases/ListUpstreamSuggestionsUseCase.ts

import { ListUpstreamSuggestionsUseCase } from '../../../../src/application/device-inventory/use-cases';
import {
  IPoweringSwitchQuery,
  IReportedApQuery,
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
  let useCase: ListUpstreamSuggestionsUseCase;

  beforeEach(() => {
    topology = {
      findAll: jest
        .fn()
        .mockResolvedValue(
          Result.ok([row('ap'), row('sta'), row('sw'), row('ap2')])
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
    useCase = new ListUpstreamSuggestionsUseCase(
      topology,
      reportedAps,
      poweringSwitches,
      makeLogger()
    );
  });

  it('[DEV-190] [DEV-191] merges both sources and reports unread switches', async () => {
    const result = await useCase.execute({});

    expect(result.value.total).toBe(2);
    expect(
      result.value.suggestions.map((s) => [s.deviceId, s.source])
    ).toEqual([
      ['sta', 'WIRELESS'],
      ['ap2', 'POE']
    ]);
    expect(result.value.unreadSwitches).toEqual([
      { deviceId: 'sw9', name: 'SW 9', reason: 'x' }
    ]);
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
});
