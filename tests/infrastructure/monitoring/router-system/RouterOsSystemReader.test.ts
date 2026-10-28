// Source: src/infrastructure/monitoring/router-system/RouterOsSystemReader.ts

import { Result } from '../../../../src/domain/shared/core';
import {
  parseUptime,
  RouterOsSystemReader
} from '../../../../src/infrastructure/monitoring/router-system/RouterOsSystemReader';
import {
  IRouterOsPrinter,
  RouterOsPrintAnswer,
  RouterPortConnection
} from '../../../../src/application/device-monitoring/interfaces';

const CONNECTION: RouterPortConnection = {
  host: '10.0.0.1',
  login: { username: 'admin', password: 'secret', apiPort: 8728 },
  agentId: null
};

type Answers = Record<string, RouterOsPrintAnswer>;

function makeReader(answers: Answers) {
  const printer: jest.Mocked<IRouterOsPrinter> = {
    print: jest.fn(async (_c, commands) =>
      Result.ok(
        commands.map(
          (c) => answers[c.command] ?? { error: 'no such command' }
        )
      )
    )
  };
  return { reader: new RouterOsSystemReader(printer), printer };
}

const V7: Answers = {
  '/system/identity/print': { rows: [{ name: 'Core-Insetel' }] },
  '/system/resource/print': {
    rows: [
      {
        uptime: '2w3d4h5m6s',
        version: '7.15.3 (stable)',
        'cpu-load': '12',
        'free-memory': '800000000',
        'total-memory': '1073741824',
        'free-hdd-space': '400000000',
        'total-hdd-space': '536870912',
        'board-name': 'RB4011iGS+'
      }
    ]
  },
  '/system/routerboard/print': {
    rows: [
      {
        routerboard: 'true',
        model: 'RB4011iGS+',
        'serial-number': 'D4440E1A2B3C',
        'current-firmware': '7.15.3',
        'upgrade-firmware': '7.16'
      }
    ]
  },
  '/system/health/print': {
    rows: [
      { name: 'voltage', value: '24.1', type: 'V' },
      { name: 'temperature', value: '41', type: 'C' }
    ]
  },
  '/interface/ethernet/print': {
    rows: [
      {
        name: 'sfp-sfpplus1',
        'default-name': 'sfp-sfpplus1',
        'mac-address': 'DC:2C:6E:00:00:0B'
      },
      {
        name: 'Uplink',
        'default-name': 'ether1',
        'mac-address': '02:00:00:00:00:01',
        'orig-mac-address': 'dc:2c:6e:00:00:01'
      }
    ]
  }
};

describe('RouterOsSystemReader', () => {
  it('[MON-160] should read a RouterOS 7 router in one batch', async () => {
    const { reader, printer } = makeReader(V7);

    const result = await reader.read(CONNECTION);

    expect(printer.print).toHaveBeenCalledTimes(1);
    expect(result.value).toEqual({
      identity: 'Core-Insetel',
      model: 'RB4011iGS+',
      serialNumber: 'D4440E1A2B3C',
      macAddress: 'DC:2C:6E:00:00:01',
      boardName: 'RB4011iGS+',
      routerOsVersion: '7.15.3',
      currentFirmware: '7.15.3',
      upgradeFirmware: '7.16',
      uptimeSeconds: 2 * 604800 + 3 * 86400 + 4 * 3600 + 5 * 60 + 6,
      cpuLoadPercent: 12,
      freeMemoryBytes: 800000000,
      totalMemoryBytes: 1073741824,
      freeHddBytes: 400000000,
      totalHddBytes: 536870912,
      voltage: 24.1,
      temperatureC: 41,
      security: null
    });
  });

  it('[MON-160] should read RouterOS 6 health from one row of fields', async () => {
    const { reader } = makeReader({
      ...V7,
      '/system/health/print': {
        rows: [{ voltage: '11.9', 'cpu-temperature': '55' }]
      }
    });

    const result = await reader.read(CONNECTION);

    expect(result.value.voltage).toBe(11.9);
    expect(result.value.temperatureC).toBe(55);
  });

  it('[MON-160] should leave fields null for commands the router refuses', async () => {
    const { reader } = makeReader({
      '/system/identity/print': V7['/system/identity/print']!,
      '/system/resource/print': V7['/system/resource/print']!
    });

    const result = await reader.read(CONNECTION);

    expect(result.isSuccess).toBe(true);
    expect(result.value.serialNumber).toBeNull();
    expect(result.value.model).toBeNull();
    expect(result.value.voltage).toBeNull();
    expect(result.value.macAddress).toBeNull();
    expect(result.value.boardName).toBe('RB4011iGS+');
  });

  it('[MON-160] should take the first port when there is no ether1', async () => {
    const { reader } = makeReader({
      ...V7,
      '/interface/ethernet/print': {
        rows: [{ name: 'sfp1', 'mac-address': 'DC:2C:6E:00:00:0B' }]
      }
    });

    expect((await reader.read(CONNECTION)).value.macAddress).toBe(
      'DC:2C:6E:00:00:0B'
    );
  });

  it('[MON-160] should ignore numbers it cannot read', async () => {
    const { reader } = makeReader({
      ...V7,
      '/system/resource/print': {
        rows: [{ 'cpu-load': '250', 'free-memory': '12MiB' }]
      }
    });

    const result = await reader.read(CONNECTION);

    expect(result.value.cpuLoadPercent).toBeNull();
    expect(result.value.freeMemoryBytes).toBeNull();
  });

  it('[MON-160] should fail when neither identity nor resources answered', async () => {
    const { reader } = makeReader({
      '/system/resource/print': { error: 'not enough permissions' }
    });

    const result = await reader.read(CONNECTION);

    expect(result.error).toBe(
      'RouterOS API error: not enough permissions'
    );
  });

  it('[MON-160] should pass a failed login on', async () => {
    const printer: IRouterOsPrinter = {
      print: async () => Result.fail('RouterOS API error: timeout')
    };

    const result = await new RouterOsSystemReader(printer).read(
      CONNECTION
    );

    expect(result.error).toBe('RouterOS API error: timeout');
  });
});

describe('RouterOsSystemReader security reads', () => {
  const SECURE: Answers = {
    ...V7,
    '/ip/service/print': {
      rows: [
        { name: 'telnet', port: '23', address: '', disabled: 'true' },
        {
          name: 'winbox',
          port: '8291',
          address: '10.0.0.0/24, 192.168.88.0/24',
          disabled: 'false'
        },
        { name: 'api', port: '8728', address: '', disabled: 'false' },
        { port: '21', address: '', disabled: 'false' },
        { name: 'resolver', port: '53', disabled: 'false' },
        {
          name: 'www',
          port: '80',
          address: '',
          disabled: 'false',
          dynamic: 'true'
        }
      ]
    },
    '/user/print': {
      rows: [
        { name: 'admin', disabled: 'true' },
        { name: 'noc', disabled: 'false' }
      ]
    },
    '/ip/neighbor/discovery-settings/print': {
      rows: [
        {
          'discover-interface-list': 'LAN',
          protocol: 'cdp,lldp,mndp'
        }
      ]
    }
  };

  it('[MON-180] should read services, enabled users and the discovery list in the same login', async () => {
    const { reader, printer } = makeReader(SECURE);

    const result = await reader.read(CONNECTION);

    expect(printer.print).toHaveBeenCalledTimes(1);
    expect(printer.print.mock.calls[0]![1]).toHaveLength(8);
    expect(result.value.security).toEqual({
      services: [
        {
          name: 'telnet',
          port: 23,
          enabled: false,
          allowedAddresses: []
        },
        {
          name: 'winbox',
          port: 8291,
          enabled: true,
          allowedAddresses: ['10.0.0.0/24', '192.168.88.0/24']
        },
        {
          name: 'api',
          port: 8728,
          enabled: true,
          allowedAddresses: []
        }
      ],
      userNames: ['noc'],
      discoveryInterfaceList: 'LAN'
    });
  });

  it('[MON-180] should leave out the dynamic services RouterOS 7 lists', async () => {
    const { reader } = makeReader(SECURE);

    const names = (
      await reader.read(CONNECTION)
    ).value.security?.services?.map((s) => s.name);

    expect(names).toEqual(['telnet', 'winbox', 'api']);
  });

  it('[MON-180] should leave a refused part null and keep the others', async () => {
    const { reader } = makeReader({
      ...SECURE,
      '/user/print': { error: 'not enough permissions' },
      '/ip/neighbor/discovery-settings/print': { rows: [{}] }
    });

    const security = (await reader.read(CONNECTION)).value.security;

    expect(security?.services).toHaveLength(3);
    expect(security?.userNames).toBeNull();
    expect(security?.discoveryInterfaceList).toBeNull();
  });

  it('[MON-180] should keep the reading when every security read is refused', async () => {
    const { reader } = makeReader(V7);

    const result = await reader.read(CONNECTION);

    expect(result.isSuccess).toBe(true);
    expect(result.value.security).toBeNull();
  });
});

describe('parseUptime', () => {
  it.each([
    ['2w3d4h5m6s', 2 * 604800 + 3 * 86400 + 4 * 3600 + 5 * 60 + 6],
    ['45m10s', 2710],
    ['1d04:05:06', 86400 + 4 * 3600 + 5 * 60 + 6],
    ['00:10:00', 600]
  ])('[MON-160] should read %s', (raw, seconds) => {
    expect(parseUptime(raw)).toBe(seconds);
  });

  it.each([undefined, '', 'soon', '3x'])(
    '[MON-160] should not read %p',
    (raw) => {
      expect(parseUptime(raw)).toBeNull();
    }
  );
});
