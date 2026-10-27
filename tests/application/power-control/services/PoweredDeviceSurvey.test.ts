// Source: src/application/power-control/services/PoweredDeviceSurvey.ts

import {
  PoweredDeviceSurvey,
  SitePoeInspector
} from '../../../../src/application/power-control/services';
import {
  IPoeSwitchTargetsQuery,
  PoeSwitchCandidate
} from '../../../../src/application/power-control/interfaces';
import {
  PoePortDTO,
  PoeSwitchDTO
} from '../../../../src/application/power-control/dtos';
import { PoePortMatchKind } from '../../../../src/domain/power-control';
import { Result } from '../../../../src/domain/shared/core';

function candidate(deviceId: string): PoeSwitchCandidate {
  return {
    deviceId,
    deviceName: deviceId,
    ipAddress: '10.0.0.1',
    firmware: 'ROUTEROS',
    reach: { by: 'server' },
    login: null
  };
}

function port(
  name: string,
  kind: PoePortMatchKind,
  deviceId: string | null
): PoePortDTO {
  return {
    port: name,
    label: '',
    mode: 'AUTO',
    status: 'POWERED',
    powerWatts: 5,
    voltage: 24,
    match: {
      kind,
      ip: '10.0.0.9',
      deviceId,
      deviceName: deviceId,
      deviceLocationName: null
    }
  } as PoePortDTO;
}

function readSwitch(
  deviceId: string,
  ports: PoePortDTO[]
): PoeSwitchDTO {
  return {
    deviceId,
    name: `Switch ${deviceId}`,
    ipAddress: '10.0.0.1',
    firmware: 'ROUTEROS',
    firmwareVersion: '7.15',
    readable: true,
    reason: null,
    error: null,
    ports
  } as PoeSwitchDTO;
}

describe('PoweredDeviceSurvey', () => {
  let targets: jest.Mocked<
    Pick<
      IPoeSwitchTargetsQuery,
      'listSwitchSites' | 'listSwitchesAtSite'
    >
  >;
  let inspector: { inspect: jest.Mock };
  let survey: PoweredDeviceSurvey;

  beforeEach(() => {
    targets = {
      listSwitchSites: jest
        .fn()
        .mockResolvedValue(Result.ok(['site-a'])),
      listSwitchesAtSite: jest
        .fn()
        .mockResolvedValue(Result.ok([candidate('sw1')]))
    };
    inspector = { inspect: jest.fn() };
    survey = new PoweredDeviceSurvey(
      targets as unknown as IPoeSwitchTargetsQuery,
      inspector as unknown as SitePoeInspector
    );
  });

  it('[DEV-191] keeps only MATCHED ports', async () => {
    inspector.inspect.mockResolvedValue(
      Result.ok([
        readSwitch('sw1', [
          port('ether2', PoePortMatchKind.MATCHED, 'ap1'),
          port(
            'ether3',
            PoePortMatchKind.MATCHED_OTHER_LOCATION,
            'ap2'
          ),
          port('ether4', PoePortMatchKind.DUPLICATE, null),
          port('ether5', PoePortMatchKind.UNMATCHED, null)
        ])
      ])
    );

    const result = await survey.survey(null);

    expect(result.value).toEqual({
      links: [
        {
          deviceId: 'ap1',
          switchDeviceId: 'sw1',
          switchName: 'Switch sw1',
          port: 'ether2'
        }
      ],
      unreadSwitches: []
    });
  });

  it('[DEV-195] reads every site with a switch when no location is given', async () => {
    targets.listSwitchSites.mockResolvedValue(
      Result.ok(['site-a', 'site-b'])
    );
    inspector.inspect.mockResolvedValue(Result.ok([]));

    await survey.survey(null);

    expect(
      targets.listSwitchesAtSite.mock.calls.map((c) => c[0])
    ).toEqual(['site-a', 'site-b']);
  });

  it('[DEV-195] reads only the location asked for', async () => {
    inspector.inspect.mockResolvedValue(Result.ok([]));

    await survey.survey('site-z');

    expect(targets.listSwitchSites).not.toHaveBeenCalled();
    expect(targets.listSwitchesAtSite).toHaveBeenCalledWith('site-z');
  });

  it('[DEV-195] reports a switch that could not be read', async () => {
    inspector.inspect.mockResolvedValue(
      Result.ok([
        {
          ...readSwitch('sw1', []),
          error: 'timeout'
        },
        {
          ...readSwitch('sw2', []),
          readable: false,
          reason: 'No login saved'
        }
      ])
    );

    const result = await survey.survey(null);

    expect(result.value.unreadSwitches).toEqual([
      { deviceId: 'sw1', name: 'Switch sw1', reason: 'timeout' },
      {
        deviceId: 'sw2',
        name: 'Switch sw2',
        reason: 'No login saved'
      }
    ]);
  });

  it('does not inspect a site without switches', async () => {
    targets.listSwitchesAtSite.mockResolvedValue(Result.ok([]));

    const result = await survey.survey(null);

    expect(result.value).toEqual({ links: [], unreadSwitches: [] });
    expect(inspector.inspect).not.toHaveBeenCalled();
  });

  it('fails when the site list cannot be read', async () => {
    targets.listSwitchSites.mockResolvedValue(Result.fail('db down'));

    const result = await survey.survey(null);

    expect(result.error).toBe('db down');
  });
});
