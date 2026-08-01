// Source: src/application/service-enforcement/services/EnforcementRouterResolver.ts

import { EnforcementRouterResolver } from '../../../../src/application/service-enforcement/services/EnforcementRouterResolver';
import { IDeviceCredentialsReader } from '../../../../src/application/service-enforcement/interfaces';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository';
import { Device } from '../../../../src/domain/device-inventory/aggregates';
import {
  DeviceName,
  DeviceStatus
} from '../../../../src/domain/device-inventory/value-objects';
import { DeviceOwnerType } from '../../../../src/domain/device-inventory/enums';
import {
  DeviceId,
  DeviceModelId
} from '../../../../src/domain/shared/ids';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { Result } from '../../../../src/domain/shared/core/Result';

const ROUTER_UUID = '550e8400-e29b-41d4-a716-4466554400b1';
const MODEL_UUID = '550e8400-e29b-41d4-a716-4466554400b2';
const ROUTER_IP = '10.0.0.1';
const NOW = new Date('2024-06-01T00:00:00.000Z');

function makeDeviceRepo(): jest.Mocked<IDeviceRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn(),
    findByLocation: jest.fn(),
    findByDeviceModel: jest.fn(),
    findByMacAddress: jest.fn(),
    findByIpAddress: jest.fn(),
    findByStatus: jest.fn(),
    existsByMacAddress: jest.fn(),
    existsByIpAddress: jest.fn(),
    findByLocationIds: jest.fn(),
    findByFilters: jest.fn(),
    countByFilters: jest.fn()
  };
}

function makeRouterDevice(
  overrides: { ipAddress?: IPAddress | null } = {}
): Device {
  return Device.reconstitute(DeviceId.parse(ROUTER_UUID).value, {
    deviceModelId: DeviceModelId.parse(MODEL_UUID).value,
    locationId: null,
    status: DeviceStatus.reconstitute(DeviceStatus.ACTIVE),
    category: null,
    ownerType: DeviceOwnerType.COMPANY,
    name: DeviceName.reconstitute('Core-Router-01'),
    serialNumber: null,
    macAddress: null,
    ipAddress:
      overrides.ipAddress !== undefined
        ? overrides.ipAddress
        : IPAddress.create(ROUTER_IP).value,
    description: null,
    installedDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    monitoringEnabled: false
  });
}

function makeSetup(routerDeviceId: string = ROUTER_UUID) {
  const deviceRepo = makeDeviceRepo();
  const credentialsReader: jest.Mocked<IDeviceCredentialsReader> = {
    findByDeviceId: jest.fn()
  };
  const resolver = new EnforcementRouterResolver(
    deviceRepo,
    credentialsReader,
    { routerDeviceId, apiPort: 8728 }
  );
  return { resolver, deviceRepo, credentialsReader };
}

describe('EnforcementRouterResolver', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should resolve host, port and credentials from the router device', async () => {
    const setup = makeSetup();
    setup.deviceRepo.findById.mockResolvedValue(
      Result.ok(makeRouterDevice())
    );
    setup.credentialsReader.findByDeviceId.mockResolvedValue(
      Result.ok({ httpUsername: 'api', httpPassword: 'secret' })
    );

    const result = await setup.resolver.resolve();

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({
      host: ROUTER_IP,
      port: 8728,
      username: 'api',
      password: 'secret'
    });
  });

  it('should fail when the configured device ID is not a valid UUID', async () => {
    const setup = makeSetup('not-a-uuid');

    const result = await setup.resolver.resolve();

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(
      'Invalid enforcement router device ID'
    );
  });

  it('should fail when the router device does not exist', async () => {
    const setup = makeSetup();
    setup.deviceRepo.findById.mockResolvedValue(Result.ok(null));

    const result = await setup.resolver.resolve();

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(
      'Enforcement router device not found'
    );
  });

  it('should fail when the router device has no IP address', async () => {
    const setup = makeSetup();
    setup.deviceRepo.findById.mockResolvedValue(
      Result.ok(makeRouterDevice({ ipAddress: null }))
    );

    const result = await setup.resolver.resolve();

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('no IP address');
  });

  it('should fail when credentials are missing or incomplete', async () => {
    const setup = makeSetup();
    setup.deviceRepo.findById.mockResolvedValue(
      Result.ok(makeRouterDevice())
    );
    setup.credentialsReader.findByDeviceId.mockResolvedValue(
      Result.ok({ httpUsername: 'api', httpPassword: null })
    );

    const result = await setup.resolver.resolve();

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('credentials not configured');
  });
});
