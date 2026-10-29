// Source: src/application/device-inventory/use-cases/ListAddressMismatchesUseCase.ts

import { ListAddressMismatchesUseCase } from '../../../../src/application/device-inventory/use-cases';
import {
  IDeviceAddressQuery,
  IRouterHostQuery
} from '../../../../src/application/device-inventory/interfaces';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core';

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

describe('ListAddressMismatchesUseCase', () => {
  let addresses: jest.Mocked<IDeviceAddressQuery>;
  let hosts: jest.Mocked<IRouterHostQuery>;
  let useCase: ListAddressMismatchesUseCase;

  beforeEach(() => {
    addresses = {
      findById: jest.fn(),
      findAll: jest.fn().mockResolvedValue(
        Result.ok([
          {
            id: 'camera',
            name: 'Camara patio',
            status: 'ACTIVE',
            ipAddress: '10.0.7.50',
            macAddresses: ['AA:BB:CC:00:00:50']
          }
        ])
      )
    };
    hosts = {
      findRouterHosts: jest.fn().mockResolvedValue(
        Result.ok({
          routers: [
            {
              routerDeviceId: 'core',
              routerName: 'Core',
              ports: [],
              bridgeHosts: null,
              arp: [
                {
                  ipAddress: '10.0.7.50',
                  macAddress: 'DE:AD:00:00:00:01'
                }
              ],
              leases: null
            },
            {
              routerDeviceId: 'hex',
              routerName: 'Hex Norte',
              ports: [],
              bridgeHosts: [],
              arp: null,
              leases: null
            }
          ],
          unreadRouters: [
            { deviceId: 'hex-2', name: 'Hex Sur', reason: 'timeout' }
          ]
        })
      )
    };
    useCase = new ListAddressMismatchesUseCase(
      addresses,
      hosts,
      makeLogger()
    );
  });

  it('[DEV-219] lists the mismatches and the routers it could not check', async () => {
    const result = await useCase.execute({});

    expect(result.value.mismatches).toEqual([
      expect.objectContaining({
        deviceId: 'camera',
        seenMacAddress: 'DE:AD:00:00:00:01',
        kind: 'UNKNOWN_MAC',
        seenBy: [{ routerDeviceId: 'core', routerName: 'Core' }]
      })
    ]);
    expect(result.value.unreadRouters).toEqual([
      { deviceId: 'hex-2', name: 'Hex Sur', reason: 'timeout' },
      {
        deviceId: 'hex',
        name: 'Hex Norte',
        reason:
          'The router did not answer its ARP table or DHCP leases'
      }
    ]);
  });

  it('[DEV-219] fails when the devices cannot be loaded', async () => {
    addresses.findAll.mockResolvedValue(Result.fail('db down'));

    const result = await useCase.execute({});

    expect(result.error).toBe('Failed to load the devices: db down');
  });

  it('[DEV-219] fails when the routers cannot be listed', async () => {
    hosts.findRouterHosts.mockResolvedValue(Result.fail('db down'));

    const result = await useCase.execute({});

    expect(result.error).toBe('Failed to read the routers: db down');
  });
});
