// Source: src/infrastructure/monitoring/router-neighbors/RouterOsNeighborReader.ts

import { Result } from '../../../../src/domain/shared/core';
import { RouterOsNeighborReader } from '../../../../src/infrastructure/monitoring/router-neighbors/RouterOsNeighborReader';
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
  return { reader: new RouterOsNeighborReader(printer), printer };
}

// As a hEX PoE on RouterOS 6.48.6 lists them.
const HEX: Answers = {
  '/ip/neighbor/print': {
    rows: [
      {
        interface: 'ether2 AP 32,bridge',
        address: '10.20.30.21',
        address4: '10.20.30.21',
        'mac-address': '24:a4:3c:0a:0b:0c',
        identity: 'AP 32',
        platform: 'LiteBeam M5',
        version: 'XW.ar934x.v6.3.6.33330.210818.1955',
        'interface-name': 'br0'
      },
      {
        interface: 'ether1,bridge',
        address: 'fe80::4a8f:5aff:fe00:1',
        address4: '10.20.30.1',
        'mac-address': '48:8F:5A:00:00:01',
        identity: 'Core',
        platform: 'MikroTik',
        board: 'RB5009UG+S+',
        version: '7.23.5 (long-term)',
        'interface-name': 'bridge-lan/ether4'
      },
      {
        interface: 'ether3 AP 03,bridge',
        'mac-address': '24:A4:3C:00:00:03'
      }
    ]
  },
  '/interface/ethernet/print': {
    rows: [
      { name: 'ether1', comment: 'Uplink' },
      { name: 'ether2 AP 32' }
    ]
  }
};

describe('RouterOsNeighborReader', () => {
  it('[MON-200] reads each neighbour with the port it was heard on', async () => {
    const { reader } = makeReader(HEX);

    const result = await reader.read(CONNECTION);

    expect(result.value.neighbors).toEqual([
      {
        port: 'ether2 AP 32',
        macAddress: '24:A4:3C:0A:0B:0C',
        ipAddress: '10.20.30.21',
        identity: 'AP 32',
        platform: 'LiteBeam M5',
        board: null,
        version: 'XW.ar934x.v6.3.6.33330.210818.1955',
        remoteInterface: 'br0'
      },
      {
        port: 'ether1',
        macAddress: '48:8F:5A:00:00:01',
        ipAddress: '10.20.30.1',
        identity: 'Core',
        platform: 'MikroTik',
        board: 'RB5009UG+S+',
        version: '7.23.5 (long-term)',
        remoteInterface: 'bridge-lan/ether4'
      },
      {
        port: 'ether3 AP 03',
        macAddress: '24:A4:3C:00:00:03',
        ipAddress: null,
        identity: null,
        platform: null,
        board: null,
        version: null,
        remoteInterface: null
      }
    ]);
  });

  it('[MON-200] reads the Ethernet ports with their comments', async () => {
    const { reader } = makeReader(HEX);

    const result = await reader.read(CONNECTION);

    expect(result.value.ports).toEqual([
      { name: 'ether1', comment: 'Uplink' },
      { name: 'ether2 AP 32', comment: null }
    ]);
  });

  it('[MON-200] uses one login for both reads', async () => {
    const { reader, printer } = makeReader(HEX);

    await reader.read(CONNECTION);

    expect(printer.print).toHaveBeenCalledTimes(1);
    expect(
      printer.print.mock.calls[0]![1].map((c) => c.command)
    ).toEqual(['/ip/neighbor/print', '/interface/ethernet/print']);
  });

  it('[MON-200] keeps the neighbours when the ports are refused', async () => {
    const { reader } = makeReader({
      '/ip/neighbor/print': HEX['/ip/neighbor/print']!
    });

    const result = await reader.read(CONNECTION);

    expect(result.value.ports).toEqual([]);
    expect(result.value.neighbors).toHaveLength(3);
  });

  it('[MON-200] fails when the neighbour table is refused', async () => {
    const { reader } = makeReader({});

    const result = await reader.read(CONNECTION);

    expect(result.error).toBe('RouterOS API error: no such command');
  });

  it('[MON-200] fails when the router cannot be logged into', async () => {
    const printer: IRouterOsPrinter = {
      print: async () => Result.fail('RouterOS API error: timeout')
    };

    const result = await new RouterOsNeighborReader(printer).read(
      CONNECTION
    );

    expect(result.error).toBe('RouterOS API error: timeout');
  });

  it('[MON-200] drops an entry with no port and ignores what is not an address', async () => {
    const { reader } = makeReader({
      '/ip/neighbor/print': {
        rows: [
          { 'mac-address': '24:A4:3C:00:00:09' },
          {
            interface: 'ether4',
            address: '10.0.0.300',
            'mac-address': 'not-a-mac'
          }
        ]
      }
    });

    const result = await reader.read(CONNECTION);

    expect(result.value.neighbors).toEqual([
      expect.objectContaining({
        port: 'ether4',
        macAddress: null,
        ipAddress: null
      })
    ]);
  });
});
