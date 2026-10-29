// Source: src/application/device-inventory/use-cases/GetDeviceNetworkLocationUseCase.ts

import { GetDeviceNetworkLocationUseCase } from '../../../../src/application/device-inventory/use-cases';
import {
  IDeviceAddressQuery,
  IRouterHostQuery,
  RouterHostsRead
} from '../../../../src/application/device-inventory/interfaces';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core';

const CAMERA = '550e8400-e29b-41d4-a716-446655440020';
const CAMERA_MAC = 'AA:BB:CC:00:00:50';
const CORE_MAC = '48:8F:5A:00:00:01';
const HEX_MAC = '48:8F:5A:00:00:02';

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

const READ: RouterHostsRead = {
  routers: [
    {
      routerDeviceId: 'core',
      routerName: 'Core',
      ports: [],
      bridgeHosts: [
        { macAddress: CORE_MAC, port: 'bridge-lan', local: true },
        { macAddress: HEX_MAC, port: 'ether4', local: false },
        { macAddress: CAMERA_MAC, port: 'ether4', local: false }
      ],
      arp: [{ ipAddress: '10.0.7.50', macAddress: CAMERA_MAC }],
      leases: null
    },
    {
      routerDeviceId: 'hex',
      routerName: 'Hex Norte',
      ports: [{ name: 'ether2', comment: 'Camara patio' }],
      bridgeHosts: [
        { macAddress: HEX_MAC, port: 'bridge', local: true },
        { macAddress: CORE_MAC, port: 'ether1', local: false },
        { macAddress: CAMERA_MAC, port: 'ether2', local: false }
      ],
      arp: [],
      leases: []
    },
    {
      routerDeviceId: 'hex-2',
      routerName: 'Hex Sur',
      ports: [],
      bridgeHosts: null,
      arp: null,
      leases: null
    }
  ],
  unreadRouters: [
    { deviceId: 'hex-3', name: 'Hex Este', reason: 'timeout' }
  ]
};

describe('GetDeviceNetworkLocationUseCase', () => {
  let addresses: jest.Mocked<IDeviceAddressQuery>;
  let hosts: jest.Mocked<IRouterHostQuery>;
  let useCase: GetDeviceNetworkLocationUseCase;

  beforeEach(() => {
    addresses = {
      findAll: jest.fn(),
      findById: jest.fn().mockResolvedValue(
        Result.ok({
          id: CAMERA,
          name: 'Camara patio',
          status: 'ACTIVE',
          ipAddress: '10.0.7.50',
          macAddresses: []
        })
      )
    };
    hosts = {
      findRouterHosts: jest.fn().mockResolvedValue(Result.ok(READ))
    };
    useCase = new GetDeviceNetworkLocationUseCase(
      addresses,
      hosts,
      makeLogger()
    );
  });

  it('[DEV-199] finds the device by the MAC ARP gives its IP and places it behind the closest port', async () => {
    const result = await useCase.execute({ deviceId: CAMERA });

    expect(result.value).toEqual({
      deviceId: CAMERA,
      deviceName: 'Camara patio',
      macAddresses: [CAMERA_MAC],
      location: {
        routerDeviceId: 'hex',
        routerName: 'Hex Norte',
        port: 'ether2',
        portComment: 'Camara patio',
        macAddress: CAMERA_MAC,
        closest: true
      },
      sightings: [
        expect.objectContaining({
          routerDeviceId: 'core',
          closest: false
        }),
        expect.objectContaining({
          routerDeviceId: 'hex',
          closest: true
        })
      ],
      unreadRouters: [
        { deviceId: 'hex-3', name: 'Hex Este', reason: 'timeout' },
        {
          deviceId: 'hex-2',
          name: 'Hex Sur',
          reason: 'The router did not answer its bridge host table'
        }
      ]
    });
  });

  it('[DEV-199] answers no location when no router sees the device', async () => {
    addresses.findById.mockResolvedValue(
      Result.ok({
        id: CAMERA,
        name: 'Camara patio',
        status: 'ACTIVE',
        ipAddress: null,
        macAddresses: ['DE:AD:00:00:00:01']
      })
    );

    const result = await useCase.execute({ deviceId: CAMERA });

    expect(result.value.location).toBeNull();
    expect(result.value.sightings).toEqual([]);
  });

  it('[DEV-199] rejects a malformed id', async () => {
    const result = await useCase.execute({ deviceId: 'nope' });

    expect(result.error).toContain('Invalid device ID');
    expect(addresses.findById).not.toHaveBeenCalled();
  });

  it('[DEV-199] fails for a device not in inventory', async () => {
    addresses.findById.mockResolvedValue(Result.ok(null));

    const result = await useCase.execute({ deviceId: CAMERA });

    expect(result.error).toBe(`Device not found: ${CAMERA}`);
    expect(hosts.findRouterHosts).not.toHaveBeenCalled();
  });

  it('[DEV-199] fails when the routers cannot be listed', async () => {
    hosts.findRouterHosts.mockResolvedValue(Result.fail('db down'));

    const result = await useCase.execute({ deviceId: CAMERA });

    expect(result.error).toBe('Failed to read the routers: db down');
  });

  it('[DEV-199] fails when the device cannot be loaded', async () => {
    addresses.findById.mockResolvedValue(Result.fail('db down'));

    const result = await useCase.execute({ deviceId: CAMERA });

    expect(result.error).toBe('Failed to load the device: db down');
  });
});
