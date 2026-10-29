// Source: src/application/device-inventory/services/NetworkLocator.ts

import {
  arpMacsOf,
  findAddressMismatches,
  locateOnNetwork,
  routersWithout
} from '../../../../src/application/device-inventory/services';
import {
  DeviceAddressRow,
  RouterHostsRow
} from '../../../../src/application/device-inventory/interfaces';

const CORE_MAC = '48:8F:5A:00:00:01';
const HEX_MAC = '48:8F:5A:00:00:02';
const CAMERA_MAC = 'AA:BB:CC:00:00:50';

function router(
  id: string,
  overrides: Partial<RouterHostsRow> = {}
): RouterHostsRow {
  return {
    routerDeviceId: id,
    routerName: `Router ${id}`,
    ports: [],
    bridgeHosts: [],
    arp: [],
    leases: [],
    ...overrides
  };
}

function device(
  id: string,
  overrides: Partial<DeviceAddressRow> = {}
): DeviceAddressRow {
  return {
    id,
    name: `Device ${id}`,
    status: 'ACTIVE',
    ipAddress: null,
    macAddresses: [],
    ...overrides
  };
}

// Core ether4 → hEX ether1; the camera hangs from hEX ether2.
const CORE = router('core', {
  ports: [{ name: 'ether4', comment: 'Backhaul' }],
  bridgeHosts: [
    { macAddress: CORE_MAC, port: 'bridge-lan', local: true },
    { macAddress: HEX_MAC, port: 'ether4', local: false },
    { macAddress: CAMERA_MAC, port: 'ether4', local: false }
  ]
});
const HEX = router('hex', {
  ports: [{ name: 'ether2', comment: 'Camara' }],
  bridgeHosts: [
    { macAddress: HEX_MAC, port: 'bridge', local: true },
    { macAddress: CORE_MAC, port: 'ether1', local: false },
    { macAddress: CAMERA_MAC, port: 'ether2', local: false }
  ]
});

describe('locateOnNetwork', () => {
  it('[DEV-199] marks the router furthest down as closest', () => {
    const sightings = locateOnNetwork([CAMERA_MAC], [CORE, HEX]);

    expect(sightings).toEqual([
      {
        routerDeviceId: 'core',
        routerName: 'Router core',
        port: 'ether4',
        portComment: 'Backhaul',
        macAddress: CAMERA_MAC,
        closest: false
      },
      {
        routerDeviceId: 'hex',
        routerName: 'Router hex',
        port: 'ether2',
        portComment: 'Camara',
        macAddress: CAMERA_MAC,
        closest: true
      }
    ]);
  });

  it('[DEV-199] keeps the upper router when the lower one sees the device only on its uplink', () => {
    const core = router('core', {
      bridgeHosts: [
        { macAddress: CORE_MAC, port: 'bridge-lan', local: true },
        { macAddress: HEX_MAC, port: 'ether4', local: false },
        { macAddress: CAMERA_MAC, port: 'ether5', local: false }
      ]
    });
    const hex = router('hex', {
      bridgeHosts: [
        { macAddress: HEX_MAC, port: 'bridge', local: true },
        { macAddress: CORE_MAC, port: 'ether1', local: false },
        { macAddress: CAMERA_MAC, port: 'ether1', local: false }
      ]
    });

    const sightings = locateOnNetwork([CAMERA_MAC], [core, hex]);

    expect(
      sightings.map((s) => [s.routerDeviceId, s.port, s.closest])
    ).toEqual([
      ['core', 'ether5', true],
      ['hex', 'ether1', false]
    ]);
  });

  it('[DEV-199] keeps a router whose lower router does not see the device', () => {
    const hex = router('hex', {
      bridgeHosts: [
        { macAddress: HEX_MAC, port: 'bridge', local: true }
      ]
    });

    const sightings = locateOnNetwork([CAMERA_MAC], [CORE, hex]);

    expect(sightings).toHaveLength(1);
    expect(sightings[0]).toMatchObject({
      routerDeviceId: 'core',
      closest: true
    });
  });

  it('[DEV-199] never places a router on its own MAC', () => {
    const sightings = locateOnNetwork([HEX_MAC], [CORE, HEX]);

    expect(sightings.map((s) => s.routerDeviceId)).toEqual(['core']);
  });

  it('[DEV-199] skips a router that refused its host table', () => {
    const sightings = locateOnNetwork(
      [CAMERA_MAC],
      [router('core', { bridgeHosts: null })]
    );

    expect(sightings).toEqual([]);
  });
});

describe('arpMacsOf', () => {
  it('[DEV-199] gives the MACs the ARP tables and leases hold for an IP', () => {
    const macs = arpMacsOf('10.0.7.50', [
      router('core', {
        arp: [{ ipAddress: '10.0.7.50', macAddress: CAMERA_MAC }]
      }),
      router('hex', {
        leases: [
          {
            ipAddress: '10.0.7.50',
            macAddress: CAMERA_MAC,
            hostname: 'camara'
          }
        ]
      })
    ]);

    expect(macs).toEqual([CAMERA_MAC]);
  });

  it('[DEV-207] ignores a MAC answering for several addresses', () => {
    const macs = arpMacsOf('10.0.7.50', [
      router('core', {
        arp: [
          { ipAddress: '10.0.7.50', macAddress: CORE_MAC },
          { ipAddress: '10.0.7.51', macAddress: CORE_MAC }
        ]
      })
    ]);

    expect(macs).toEqual([]);
  });
});

describe('findAddressMismatches', () => {
  const camera = device('camera', {
    ipAddress: '10.0.7.50',
    macAddresses: [CAMERA_MAC]
  });

  it('[DEV-219] names the other device that holds the MAC', () => {
    const nvr = device('nvr', {
      macAddresses: ['AA:BB:CC:00:00:99']
    });

    const mismatches = findAddressMismatches(
      [camera, nvr],
      [
        router('core', {
          arp: [
            {
              ipAddress: '10.0.7.50',
              macAddress: 'AA:BB:CC:00:00:99'
            }
          ]
        }),
        router('hex', {
          arp: [
            {
              ipAddress: '10.0.7.50',
              macAddress: 'AA:BB:CC:00:00:99'
            }
          ]
        })
      ]
    );

    expect(mismatches).toEqual([
      {
        deviceId: 'camera',
        deviceName: 'Device camera',
        ipAddress: '10.0.7.50',
        macAddressesOnFile: [CAMERA_MAC],
        seenMacAddress: 'AA:BB:CC:00:00:99',
        kind: 'OTHER_DEVICE',
        otherDeviceId: 'nvr',
        otherDeviceName: 'Device nvr',
        seenBy: [
          { routerDeviceId: 'core', routerName: 'Router core' },
          { routerDeviceId: 'hex', routerName: 'Router hex' }
        ]
      }
    ]);
  });

  it('[DEV-219] lists a MAC no device in inventory has', () => {
    const mismatches = findAddressMismatches(
      [camera],
      [
        router('core', {
          leases: [
            {
              ipAddress: '10.0.7.50',
              macAddress: 'DE:AD:00:00:00:01',
              hostname: null
            }
          ]
        })
      ]
    );

    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({
      kind: 'UNKNOWN_MAC',
      otherDeviceId: null
    });
  });

  it('[DEV-219] accepts any MAC the device reports as its own', () => {
    const radio = device('radio', {
      ipAddress: '10.0.7.21',
      macAddresses: ['24:A4:3C:00:00:01', '26:A4:3C:00:00:01']
    });

    const mismatches = findAddressMismatches(
      [radio],
      [
        router('core', {
          arp: [
            {
              ipAddress: '10.0.7.21',
              macAddress: '26:A4:3C:00:00:01'
            }
          ]
        })
      ]
    );

    expect(mismatches).toEqual([]);
  });

  it.each([
    ['out of service', { status: 'INVENTORY' }],
    ['with no MAC to compare', { macAddresses: [] }],
    ['with no IP', { ipAddress: null }]
  ])('[DEV-219] skips a device %s', (_label, overrides) => {
    const mismatches = findAddressMismatches(
      [{ ...camera, ...overrides }],
      [
        router('core', {
          arp: [
            {
              ipAddress: '10.0.7.50',
              macAddress: 'DE:AD:00:00:00:01'
            }
          ]
        })
      ]
    );

    expect(mismatches).toEqual([]);
  });

  it('[DEV-207] skips a MAC answering for several addresses', () => {
    const mismatches = findAddressMismatches(
      [camera],
      [
        router('core', {
          arp: [
            { ipAddress: '10.0.7.50', macAddress: CORE_MAC },
            { ipAddress: '10.0.7.51', macAddress: CORE_MAC }
          ]
        })
      ]
    );

    expect(mismatches).toEqual([]);
  });
});

describe('routersWithout', () => {
  it('[DEV-199] [DEV-219] lists the routers that refused the table needed', () => {
    const routers = [
      router('a', { bridgeHosts: null }),
      router('b', { arp: null, leases: null }),
      router('c', { arp: null })
    ];

    expect(routersWithout(routers, 'bridgeHosts')).toEqual([
      {
        deviceId: 'a',
        name: 'Router a',
        reason: 'The router did not answer its bridge host table'
      }
    ]);
    expect(routersWithout(routers, 'addresses')).toEqual([
      {
        deviceId: 'b',
        name: 'Router b',
        reason:
          'The router did not answer its ARP table or DHCP leases'
      }
    ]);
  });
});
