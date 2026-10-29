// Source: src/application/device-inventory/services/RouterNeighborMap.ts

import {
  RouterNeighborMap,
  findNeighborOwners
} from '../../../../src/application/device-inventory/services';
import {
  IKnownDeviceLookup,
  KnownDeviceOwners,
  RouterNeighborRow,
  RouterNeighborsRow,
  TopologyDeviceRow
} from '../../../../src/application/device-inventory/interfaces';
import { Result } from '../../../../src/domain/shared/core';

function row(
  id: string,
  overrides: Partial<TopologyDeviceRow> = {}
): TopologyDeviceRow {
  return {
    id,
    name: `Name ${id}`,
    status: 'ACTIVE',
    category: null,
    ipAddress: null,
    locationId: null,
    locationName: null,
    upstreamDeviceId: null,
    connectivity: 'UP',
    downSince: null,
    ...overrides
  };
}

function heard(
  port: string,
  ipAddress: string,
  overrides: Partial<RouterNeighborRow> = {}
): RouterNeighborRow {
  return {
    port,
    macAddress: null,
    ipAddress,
    identity: null,
    platform: null,
    board: null,
    version: null,
    remoteInterface: 'br0',
    ...overrides
  };
}

function router(
  routerDeviceId: string,
  neighbors: RouterNeighborRow[],
  ports: RouterNeighborsRow['ports'] = []
): RouterNeighborsRow {
  return {
    routerDeviceId,
    routerName: `Name ${routerDeviceId}`,
    ports,
    neighbors
  };
}

// IP 10.0.0.<n> belongs to the device of that name.
function owners(byIp: Record<string, string>): KnownDeviceOwners {
  return { byMac: new Map(), byIp: new Map(Object.entries(byIp)) };
}

const ROWS = [
  row('core', { category: 'GATEWAY' }),
  row('hex', { upstreamDeviceId: 'core' }),
  row('ap32'),
  row('ap03'),
  row('sta')
];
const OWNERS = owners({
  '10.0.0.1': 'core',
  '10.0.0.2': 'hex',
  '10.0.0.32': 'ap32',
  '10.0.0.3': 'ap03',
  '10.0.0.50': 'sta'
});

describe('RouterNeighborMap', () => {
  describe('ports (DEV-198)', () => {
    it('[DEV-198] lists every Ethernet port, then the other ports heard on', () => {
      const map = new RouterNeighborMap(
        [
          router(
            'hex',
            [heard('vlan20', '10.0.0.32')],
            [
              { name: 'ether1', comment: null },
              { name: 'ether2', comment: 'AP 32' }
            ]
          )
        ],
        OWNERS,
        ROWS
      );

      expect(
        map.ports('hex').map((p) => [p.port, p.comment])
      ).toEqual([
        ['ether1', null],
        ['ether2', 'AP 32'],
        ['vlan20', null]
      ]);
    });

    it('[DEV-201] matches each neighbour with inventory and names it', () => {
      const map = new RouterNeighborMap(
        [
          router('hex', [
            heard('ether2', '10.0.0.99', {
              macAddress: '24:a4:3c:00:00:32',
              identity: 'AP 32'
            }),
            heard('ether2', '10.0.0.77')
          ])
        ],
        {
          byMac: new Map([['24:A4:3C:00:00:32', 'ap32']]),
          byIp: new Map()
        },
        ROWS
      );

      const [port] = map.ports('hex');

      expect(port!.neighbors.map((n) => n.knownDeviceName)).toEqual([
        'Name ap32',
        null
      ]);
    });

    it('[DEV-197] marks a neighbour heard over its own radio as wireless', () => {
      const map = new RouterNeighborMap(
        [
          router('hex', [
            heard('ether2', '10.0.0.32'),
            heard('ether2', '10.0.0.50', { remoteInterface: 'ath0' }),
            heard('ether2', '10.0.0.51', {
              remoteInterface: 'bridge1/wlan1'
            })
          ])
        ],
        OWNERS,
        ROWS
      );

      expect(
        map.ports('hex')[0]!.neighbors.map((n) => n.wireless)
      ).toEqual([false, true, true]);
    });

    it('[DEV-198] suggests the name of the one device cabled to a port', () => {
      const map = new RouterNeighborMap(
        [
          router(
            'hex',
            [
              heard('ether2', '10.0.0.32'),
              heard('ether2', '10.0.0.50', {
                remoteInterface: 'ath0'
              })
            ],
            [{ name: 'ether2', comment: null }]
          )
        ],
        OWNERS,
        ROWS
      );

      expect(map.ports('hex')[0]!.suggestedComment).toBe('Name ap32');
    });

    it('[DEV-198] suggests nothing when the comment already names it', () => {
      const map = new RouterNeighborMap(
        [
          router(
            'hex',
            [heard('ether2', '10.0.0.32')],
            [{ name: 'ether2', comment: 'Hacia NAME AP32' }]
          )
        ],
        OWNERS,
        [
          ...ROWS.filter((r) => r.id !== 'ap32'),
          row('ap32', { name: 'AP32' })
        ]
      );

      expect(map.ports('hex')[0]!.suggestedComment).toBeNull();
    });

    it('[DEV-197] suggests nothing for a device inventory lacks', () => {
      const map = new RouterNeighborMap(
        [router('hex', [heard('ether2', '10.0.0.200')])],
        OWNERS,
        ROWS
      );

      expect(map.ports('hex')[0]!.suggestedComment).toBeNull();
    });

    it('[DEV-197] counts one device heard under two entries once', () => {
      const map = new RouterNeighborMap(
        [
          router('hex', [
            heard('ether2', '10.0.0.32'),
            heard('ether2', '10.0.0.32', { identity: 'AP 32 (LLDP)' })
          ])
        ],
        OWNERS,
        ROWS
      );

      expect(map.ports('hex')[0]!.suggestedComment).toBe('Name ap32');
    });

    it('[DEV-197] flags the port that hears the router’s own upstream as the uplink', () => {
      const map = new RouterNeighborMap(
        [router('hex', [heard('ether1', '10.0.0.1')])],
        OWNERS,
        ROWS
      );

      expect(map.ports('hex')[0]).toMatchObject({
        uplink: true,
        suggestedComment: null
      });
    });

    it('[DEV-197] flags a port that hears a gateway as the uplink', () => {
      const map = new RouterNeighborMap(
        [router('ap32', [heard('ether1', '10.0.0.1')])],
        OWNERS,
        ROWS
      );

      expect(map.ports('ap32')[0]!.uplink).toBe(true);
    });

    it('does not match the router with itself', () => {
      const map = new RouterNeighborMap(
        [router('hex', [heard('ether2', '10.0.0.2')])],
        OWNERS,
        ROWS
      );

      expect(
        map.ports('hex')[0]!.neighbors[0]!.knownDeviceId
      ).toBeNull();
    });

    it('answers no ports for a router it was not given', () => {
      expect(
        new RouterNeighborMap([], OWNERS, ROWS).ports('hex')
      ).toEqual([]);
    });
  });

  describe('links (DEV-196)', () => {
    it('[DEV-196] links each device clearly cabled to a router port', () => {
      const map = new RouterNeighborMap(
        [
          router('hex', [
            heard('ether1', '10.0.0.1'),
            heard('ether1', '10.0.0.50'),
            heard('ether2', '10.0.0.32'),
            heard('ether2', '10.0.0.50', { remoteInterface: 'ath0' }),
            heard('ether3', '10.0.0.3'),
            heard('ether3', '10.0.0.200')
          ])
        ],
        OWNERS,
        ROWS
      );

      expect(map.links()).toEqual([
        { deviceId: 'ap32', routerDeviceId: 'hex', port: 'ether2' }
      ]);
    });

    it('[DEV-196] leaves out a device that looks cabled to two ports', () => {
      const map = new RouterNeighborMap(
        [
          router('hex', [heard('ether2', '10.0.0.32')]),
          router('core', [heard('ether5', '10.0.0.32')])
        ],
        OWNERS,
        ROWS
      );

      expect(map.links()).toEqual([]);
    });

    it('[DEV-196] leaves out two routers that each clearly hear the other', () => {
      const rows = [row('hexA'), row('hexB')];
      const map = new RouterNeighborMap(
        [
          router('hexA', [heard('ether1', '10.0.0.11')]),
          router('hexB', [heard('ether1', '10.0.0.10')])
        ],
        owners({ '10.0.0.10': 'hexA', '10.0.0.11': 'hexB' }),
        rows
      );

      expect(map.links()).toEqual([]);
    });
  });
});

describe('findNeighborOwners', () => {
  it('[DEV-201] looks up each MAC and IP once', async () => {
    const lookup: jest.Mocked<IKnownDeviceLookup> = {
      findOwners: jest
        .fn()
        .mockResolvedValue(
          Result.ok({ byMac: new Map(), byIp: new Map() })
        )
    };

    await findNeighborOwners(lookup, [
      router('hex', [
        heard('ether2', '10.0.0.32', {
          macAddress: '24:a4:3c:00:00:32'
        }),
        heard('ether3', '10.0.0.32', {
          macAddress: '24:A4:3C:00:00:32'
        })
      ])
    ]);

    expect(lookup.findOwners).toHaveBeenCalledWith(
      ['24:A4:3C:00:00:32'],
      ['10.0.0.32']
    );
  });

  it('does not query when nothing was heard', async () => {
    const lookup: jest.Mocked<IKnownDeviceLookup> = {
      findOwners: jest.fn()
    };

    const result = await findNeighborOwners(lookup, [
      router('hex', [])
    ]);

    expect(result.value.byIp.size).toBe(0);
    expect(lookup.findOwners).not.toHaveBeenCalled();
  });
});
