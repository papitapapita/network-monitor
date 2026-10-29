// Source: src/application/device-inventory/services/UpstreamSuggester.ts

import { UpstreamSuggester } from '../../../../src/application/device-inventory/services';
import {
  PoweringSwitchRow,
  ReportedApRow,
  TopologyDeviceRow
} from '../../../../src/application/device-inventory/interfaces';

function row(
  id: string,
  upstreamDeviceId: string | null = null,
  overrides: Partial<TopologyDeviceRow> = {}
): TopologyDeviceRow {
  return {
    id,
    name: `Name ${id}`,
    status: 'ACTIVE',
    category: null,
    ipAddress: `10.0.0.${id.length}`,
    locationId: 'loc-a',
    locationName: 'Torre Norte',
    upstreamDeviceId,
    connectivity: 'UP',
    downSince: null,
    ...overrides
  };
}

const observedAt = new Date('2026-10-29T12:00:00.000Z');

function reported(
  stationId: string,
  apDeviceId: string | null,
  matchedBy: ReportedApRow['matchedBy'] = 'MAC'
): ReportedApRow {
  return {
    stationId,
    apDeviceId,
    matchedBy: apDeviceId ? matchedBy : null,
    observedAt
  };
}

function powered(
  deviceId: string,
  switchDeviceId: string
): PoweringSwitchRow {
  return { deviceId, switchDeviceId, port: 'ether3' };
}

describe('UpstreamSuggester', () => {
  it('[DEV-190] suggests the AP a station reports, with how it was matched', () => {
    const suggester = new UpstreamSuggester([row('ap'), row('sta')]);

    const result = suggester.suggest(
      [reported('sta', 'ap', 'IP')],
      [],
      [],
      null
    );

    expect(result).toEqual([
      {
        deviceId: 'sta',
        deviceName: 'Name sta',
        ipAddress: '10.0.0.3',
        locationName: 'Torre Norte',
        currentUpstreamDeviceId: null,
        currentUpstreamDeviceName: null,
        suggestedUpstreamDeviceId: 'ap',
        suggestedUpstreamDeviceName: 'Name ap',
        source: 'WIRELESS',
        matchedBy: 'IP',
        observedAt: observedAt.toISOString(),
        port: null
      }
    ]);
  });

  it('[DEV-190] names the current upstream when the radio reports another AP', () => {
    const suggester = new UpstreamSuggester([
      row('ap1'),
      row('ap2'),
      row('sta', 'ap1')
    ]);

    const [suggestion] = suggester.suggest(
      [reported('sta', 'ap2')],
      [],
      [],
      null
    );

    expect(suggestion).toMatchObject({
      currentUpstreamDeviceId: 'ap1',
      currentUpstreamDeviceName: 'Name ap1',
      suggestedUpstreamDeviceId: 'ap2'
    });
  });

  it('[DEV-190] skips a station whose AP is unknown', () => {
    const suggester = new UpstreamSuggester([row('sta')]);

    expect(
      suggester.suggest([reported('sta', null)], [], [], null)
    ).toEqual([]);
  });

  it('[DEV-191] suggests the switch whose port powers an antenna', () => {
    const suggester = new UpstreamSuggester([row('sw'), row('ap')]);

    const [suggestion] = suggester.suggest(
      [],
      [powered('ap', 'sw')],
      [],
      null
    );

    expect(suggestion).toMatchObject({
      deviceId: 'ap',
      suggestedUpstreamDeviceId: 'sw',
      source: 'POE',
      port: 'ether3',
      matchedBy: null,
      observedAt: null
    });
  });

  it('[DEV-191] never suggests a PoE switch for a station, even one never read', () => {
    const suggester = new UpstreamSuggester([row('sw'), row('sta')]);

    const result = suggester.suggest(
      [reported('sta', null)],
      [powered('sta', 'sw')],
      [],
      null
    );

    expect(result).toEqual([]);
  });

  it('[DEV-192] skips a proposal that matches the current link', () => {
    const suggester = new UpstreamSuggester([
      row('ap'),
      row('sta', 'ap'),
      row('sw'),
      row('ap2', 'sw')
    ]);

    const result = suggester.suggest(
      [reported('sta', 'ap')],
      [powered('ap2', 'sw')],
      [],
      null
    );

    expect(result).toEqual([]);
  });

  it('[DEV-192] skips a device or upstream that is not on the network', () => {
    const suggester = new UpstreamSuggester([
      row('ap', null, { status: 'INVENTORY' }),
      row('sta'),
      row('sw'),
      row('ap2', null, { status: 'DAMAGED' })
    ]);

    const result = suggester.suggest(
      [reported('sta', 'ap'), reported('sta2', 'sw')],
      [powered('ap2', 'sw'), powered('ghost', 'sw')],
      [],
      null
    );

    expect(result).toEqual([]);
  });

  it('[DEV-192] skips a device reported as its own upstream', () => {
    const suggester = new UpstreamSuggester([row('sta')]);

    expect(
      suggester.suggest([reported('sta', 'sta')], [], [], null)
    ).toEqual([]);
  });

  it('[DEV-193] skips a proposal that would close a loop', () => {
    const suggester = new UpstreamSuggester([
      row('sw', 'ap'),
      row('ap', 'bh'),
      row('bh')
    ]);

    expect(
      suggester.suggest([], [powered('ap', 'sw')], [], null)
    ).toEqual([]);
  });

  it('[DEV-195] keeps only devices at the location asked for', () => {
    const suggester = new UpstreamSuggester([
      row('ap'),
      row('sta1'),
      row('sta2', null, { locationId: 'loc-b' })
    ]);

    const result = suggester.suggest(
      [reported('sta1', 'ap'), reported('sta2', 'ap')],
      [],
      [],
      'loc-b'
    );

    expect(result.map((s) => s.deviceId)).toEqual(['sta2']);
  });

  it('lists suggestions in topology order', () => {
    const suggester = new UpstreamSuggester([
      row('sw'),
      row('ap1'),
      row('ap2')
    ]);

    const result = suggester.suggest(
      [],
      [powered('ap2', 'sw'), powered('ap1', 'sw')],
      [],
      null
    );

    expect(result.map((s) => s.deviceId)).toEqual(['ap1', 'ap2']);
  });

  describe('router neighbours', () => {
    const cabled = (deviceId: string, routerDeviceId: string) => ({
      deviceId,
      routerDeviceId,
      port: 'ether2 AP 32'
    });

    it('[DEV-196] suggests the router port a device is cabled to', () => {
      const suggester = new UpstreamSuggester([
        row('hex'),
        row('ap')
      ]);

      const [suggestion] = suggester.suggest(
        [],
        [],
        [cabled('ap', 'hex')],
        null
      );

      expect(suggestion).toMatchObject({
        deviceId: 'ap',
        suggestedUpstreamDeviceId: 'hex',
        suggestedUpstreamDeviceName: 'Name hex',
        source: 'ROUTER_NEIGHBOR',
        matchedBy: null,
        observedAt: null,
        port: 'ether2 AP 32'
      });
    });

    it('[DEV-196] prefers the PoE port over the router port', () => {
      const suggester = new UpstreamSuggester([
        row('hex'),
        row('sw'),
        row('ap')
      ]);

      const [suggestion] = suggester.suggest(
        [],
        [powered('ap', 'sw')],
        [cabled('ap', 'hex')],
        null
      );

      expect(suggestion).toMatchObject({
        suggestedUpstreamDeviceId: 'sw',
        source: 'POE'
      });
    });

    it('[DEV-196] leaves a station to what its radio reports', () => {
      const suggester = new UpstreamSuggester([
        row('hex'),
        row('ap'),
        row('sta')
      ]);

      const result = suggester.suggest(
        [reported('sta', null)],
        [],
        [cabled('sta', 'hex')],
        null
      );

      expect(result).toEqual([]);
    });

    it('[DEV-193] skips a router port that would close a loop', () => {
      const suggester = new UpstreamSuggester([
        row('core'),
        row('hex', 'core')
      ]);

      expect(
        suggester.suggest([], [], [cabled('core', 'hex')], null)
      ).toEqual([]);
    });
  });
});
