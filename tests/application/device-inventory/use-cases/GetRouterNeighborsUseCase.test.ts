// Source: src/application/device-inventory/use-cases/GetRouterNeighborsUseCase.ts

import { GetRouterNeighborsUseCase } from '../../../../src/application/device-inventory/use-cases';
import {
  IKnownDeviceLookup,
  IRouterNeighborQuery,
  ITopologyQuery,
  TopologyDeviceRow
} from '../../../../src/application/device-inventory/interfaces';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core';

const HEX = '550e8400-e29b-41d4-a716-446655440010';
const AP = '550e8400-e29b-41d4-a716-446655440011';

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

function row(id: string, name: string): TopologyDeviceRow {
  return {
    id,
    name,
    status: 'ACTIVE',
    category: null,
    ipAddress: null,
    locationId: null,
    locationName: null,
    upstreamDeviceId: null,
    connectivity: 'UP',
    downSince: null
  };
}

describe('GetRouterNeighborsUseCase', () => {
  let neighbors: jest.Mocked<IRouterNeighborQuery>;
  let knownDevices: jest.Mocked<IKnownDeviceLookup>;
  let topology: jest.Mocked<ITopologyQuery>;
  let useCase: GetRouterNeighborsUseCase;

  beforeEach(() => {
    neighbors = {
      findRouterNeighbors: jest.fn(),
      findRouterNeighborsOf: jest.fn().mockResolvedValue(
        Result.ok({
          routers: [
            {
              routerDeviceId: HEX,
              routerName: 'Hex Norte',
              ports: [{ name: 'ether2', comment: null }],
              neighbors: [
                {
                  port: 'ether2',
                  macAddress: null,
                  ipAddress: '10.0.7.21',
                  identity: 'AP 32',
                  platform: 'LiteBeam M5',
                  board: null,
                  version: null,
                  remoteInterface: 'br0'
                }
              ]
            }
          ],
          unreadRouters: []
        })
      )
    };
    knownDevices = {
      findOwners: jest.fn().mockResolvedValue(
        Result.ok({
          byMac: new Map(),
          byIp: new Map([['10.0.7.21', AP]])
        })
      )
    };
    topology = {
      findAll: jest
        .fn()
        .mockResolvedValue(
          Result.ok([row(HEX, 'Hex Norte'), row(AP, 'AP 32')])
        )
    };
    useCase = new GetRouterNeighborsUseCase(
      neighbors,
      knownDevices,
      topology,
      makeLogger()
    );
  });

  it('[DEV-198] lists what each port hears, with the comment it could carry', async () => {
    const result = await useCase.execute({ deviceId: HEX });

    expect(neighbors.findRouterNeighborsOf).toHaveBeenCalledWith(HEX);
    expect(result.value).toEqual({
      deviceId: HEX,
      deviceName: 'Hex Norte',
      reason: null,
      ports: [
        {
          port: 'ether2',
          comment: null,
          uplink: false,
          suggestedComment: 'AP 32',
          neighbors: [
            {
              macAddress: null,
              ipAddress: '10.0.7.21',
              identity: 'AP 32',
              platform: 'LiteBeam M5',
              board: null,
              version: null,
              remoteInterface: 'br0',
              wireless: false,
              knownDeviceId: AP,
              knownDeviceName: 'AP 32'
            }
          ]
        }
      ]
    });
  });

  it('[DEV-198] answers why a router could not be read', async () => {
    neighbors.findRouterNeighborsOf.mockResolvedValue(
      Result.ok({
        routers: [],
        unreadRouters: [
          { deviceId: HEX, name: 'Hex Norte', reason: 'timeout' }
        ]
      })
    );

    const result = await useCase.execute({ deviceId: HEX });

    expect(result.value).toEqual({
      deviceId: HEX,
      deviceName: 'Hex Norte',
      reason: 'timeout',
      ports: []
    });
    expect(knownDevices.findOwners).not.toHaveBeenCalled();
  });

  it('fails as not found for a device that is not a MikroTik router', async () => {
    neighbors.findRouterNeighborsOf.mockResolvedValue(
      Result.ok(null)
    );

    const result = await useCase.execute({ deviceId: HEX });

    expect(result.error).toBe(`MikroTik router not found: ${HEX}`);
  });

  it('refuses a malformed id', async () => {
    const result = await useCase.execute({ deviceId: 'nope' });

    expect(result.error).toContain('Invalid device ID');
  });

  it('fails when the router list cannot be loaded', async () => {
    neighbors.findRouterNeighborsOf.mockResolvedValue(
      Result.fail('db down')
    );

    const result = await useCase.execute({ deviceId: HEX });

    expect(result.error).toBe('Failed to read the router: db down');
  });
});
