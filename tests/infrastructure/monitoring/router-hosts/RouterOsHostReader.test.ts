// Source: src/infrastructure/monitoring/router-hosts/RouterOsHostReader.ts

import { Result } from '../../../../src/domain/shared/core';
import {
  RouterOsHostReader,
  parseArpEntry,
  parseBridgeHost,
  parseDhcpLease
} from '../../../../src/infrastructure/monitoring/router-hosts/RouterOsHostReader';
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
  return { reader: new RouterOsHostReader(printer), printer };
}

const ANSWERS: Answers = {
  '/interface/ethernet/print': {
    rows: [{ name: 'ether1', comment: 'Uplink' }, { name: 'ether2' }]
  },
  '/interface/bridge/host/print': {
    rows: [
      { 'mac-address': '24:a4:3c:00:00:01', interface: 'ether2' },
      {
        'mac-address': '48:8F:5A:00:00:01',
        interface: 'bridge',
        local: 'true'
      }
    ]
  },
  '/ip/arp/print': {
    rows: [
      {
        address: '10.0.7.21',
        'mac-address': '24:A4:3C:00:00:01',
        interface: 'bridge'
      }
    ]
  },
  '/ip/dhcp-server/lease/print': {
    rows: [
      {
        address: '10.0.7.50',
        'mac-address': 'AA:BB:CC:00:00:50',
        'host-name': 'camara-patio',
        status: 'bound'
      }
    ]
  }
};

describe('RouterOsHostReader', () => {
  it('[MON-202] reads ports, bridge hosts, ARP and leases in one login', async () => {
    const { reader, printer } = makeReader(ANSWERS);

    const result = await reader.read(CONNECTION);

    expect(printer.print).toHaveBeenCalledTimes(1);
    expect(
      printer.print.mock.calls[0]![1].map((c) => c.command)
    ).toEqual([
      '/interface/ethernet/print',
      '/interface/bridge/host/print',
      '/ip/arp/print',
      '/ip/dhcp-server/lease/print'
    ]);
    expect(result.value).toEqual({
      ports: [
        { name: 'ether1', comment: 'Uplink' },
        { name: 'ether2', comment: null }
      ],
      bridgeHosts: [
        {
          macAddress: '24:A4:3C:00:00:01',
          port: 'ether2',
          local: false
        },
        {
          macAddress: '48:8F:5A:00:00:01',
          port: 'bridge',
          local: true
        }
      ],
      arp: [
        {
          ipAddress: '10.0.7.21',
          macAddress: '24:A4:3C:00:00:01',
          interface: 'bridge'
        }
      ],
      leases: [
        {
          ipAddress: '10.0.7.50',
          macAddress: 'AA:BB:CC:00:00:50',
          hostname: 'camara-patio'
        }
      ]
    });
  });

  it('[MON-202] answers null for each table the router refuses', async () => {
    const { reader } = makeReader({});

    const result = await reader.read(CONNECTION);

    expect(result.value).toEqual({
      ports: [],
      bridgeHosts: null,
      arp: null,
      leases: null
    });
  });

  it('[MON-202] fails only when the login fails', async () => {
    const printer: IRouterOsPrinter = {
      print: jest.fn().mockResolvedValue(Result.fail('timeout'))
    };

    const result = await new RouterOsHostReader(printer).read(
      CONNECTION
    );

    expect(result.error).toBe('timeout');
  });

  describe('parseBridgeHost', () => {
    it('[MON-202] takes the port from on-interface on RouterOS 6', () => {
      expect(
        parseBridgeHost({
          'mac-address': '24:A4:3C:00:00:01',
          'on-interface': 'ether3'
        })
      ).toEqual({
        macAddress: '24:A4:3C:00:00:01',
        port: 'ether3',
        local: false
      });
    });

    it.each([
      [{ 'mac-address': '24:A4:3C:00:00:01' }],
      [{ 'mac-address': 'nonsense', interface: 'ether2' }],
      [
        {
          'mac-address': '24:A4:3C:00:00:01',
          interface: 'ether2',
          invalid: 'true'
        }
      ],
      [
        {
          'mac-address': '24:A4:3C:00:00:01',
          interface: 'ether2',
          disabled: 'true'
        }
      ]
    ])(
      '[MON-202] drops an entry with no port, MAC or validity',
      (row) => {
        expect(parseBridgeHost(row)).toBeNull();
      }
    );
  });

  describe('parseArpEntry', () => {
    const ENTRY = {
      address: '10.0.7.21',
      'mac-address': '24:a4:3c:00:00:01',
      interface: 'bridge'
    };

    it('[MON-202] upper-cases the MAC', () => {
      expect(parseArpEntry(ENTRY)?.macAddress).toBe(
        '24:A4:3C:00:00:01'
      );
    });

    it.each([
      [{ ...ENTRY, 'mac-address': '' }],
      [{ ...ENTRY, 'mac-address': '00:00:00:00:00:00' }],
      [{ ...ENTRY, address: 'fe80::1' }],
      [{ ...ENTRY, invalid: 'true' }],
      [{ ...ENTRY, published: 'true' }],
      [{ ...ENTRY, status: 'failed' }],
      [{ ...ENTRY, status: 'incomplete' }]
    ])(
      '[MON-202] drops an unresolved, published or invalid entry',
      (row) => {
        expect(parseArpEntry(row)).toBeNull();
      }
    );

    it('[MON-202] keeps a stale entry: the MAC was seen', () => {
      expect(
        parseArpEntry({ ...ENTRY, status: 'stale' })
      ).not.toBeNull();
    });
  });

  describe('parseDhcpLease', () => {
    it('[MON-202] prefers the active address and MAC', () => {
      expect(
        parseDhcpLease({
          address: '10.0.7.50',
          'mac-address': 'AA:BB:CC:00:00:50',
          'active-address': '10.0.7.51',
          'active-mac-address': 'AA:BB:CC:00:00:51',
          status: 'bound'
        })
      ).toEqual({
        ipAddress: '10.0.7.51',
        macAddress: 'AA:BB:CC:00:00:51',
        hostname: null
      });
    });

    it('[MON-202] drops a lease that is not bound', () => {
      expect(
        parseDhcpLease({
          address: '10.0.7.50',
          'mac-address': 'AA:BB:CC:00:00:50',
          status: 'waiting'
        })
      ).toBeNull();
    });
  });
});
