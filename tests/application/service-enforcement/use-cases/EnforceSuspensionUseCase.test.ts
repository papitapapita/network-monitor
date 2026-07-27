// Source: src/application/service-enforcement/use-cases/EnforceSuspensionUseCase.ts

import { EnforceSuspensionUseCase } from '../../../../src/application/service-enforcement/use-cases/EnforceSuspensionUseCase';
import { EnforcementRouterResolver } from '../../../../src/application/service-enforcement/services/EnforcementRouterResolver';
import {
  IRouterQueueService,
  RouterConnection
} from '../../../../src/application/service-enforcement/interfaces';
import { IContractedServiceRepository } from '../../../../src/domain/customers/repository/IContractedServiceRepository';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository';
import { ContractedService } from '../../../../src/domain/customers/aggregates/ContractedService';
import { ContractedServiceStatus } from '../../../../src/domain/customers/enums/ContractedServiceStatus';
import { Device } from '../../../../src/domain/device-inventory/aggregates';
import {
  DeviceName,
  DeviceStatus
} from '../../../../src/domain/device-inventory/value-objects';
import { DeviceOwnerType } from '../../../../src/domain/device-inventory/enums';
import {
  ContractedServiceId,
  CustomerId,
  ServicePlanId,
  DeviceId,
  DeviceModelId
} from '../../../../src/domain/shared/ids';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

const CS_UUID = '550e8400-e29b-41d4-a716-446655440080';
const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440081';
const MODEL_UUID = '550e8400-e29b-41d4-a716-446655440082';
const CUSTOMER_IP = '10.20.30.40';
const NOW = new Date('2024-06-01T00:00:00.000Z');

const ROUTER_CONNECTION: RouterConnection = {
  host: '10.0.0.1',
  port: 8728,
  username: 'api',
  password: 'secret'
};

function makeLogger(): jest.Mocked<ILogger> {
  const child: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setLevel: jest.fn(),
    child: jest.fn()
  };
  child.child.mockReturnValue(child);
  return child;
}

function makeServiceRepo(): jest.Mocked<IContractedServiceRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByCustomerId: jest.fn(),
    findByServicePlanId: jest.fn(),
    findByDeviceId: jest.fn(),
    findByStatus: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    count: jest.fn()
  };
}

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
    findByFilters: jest.fn()
  };
}

function makeService(
  overrides: {
    status?: ContractedServiceStatus;
    deviceId?: DeviceId | null;
  } = {}
): ContractedService {
  return ContractedService.reconstitute(
    ContractedServiceId.parse(CS_UUID).value,
    {
      customerId: CustomerId.create(),
      servicePlanId: ServicePlanId.create(),
      deviceId:
        overrides.deviceId !== undefined
          ? overrides.deviceId
          : DeviceId.parse(DEVICE_UUID).value,
      status: overrides.status ?? ContractedServiceStatus.SUSPENDED,
      startDate: NOW,
      createdAt: NOW,
      updatedAt: NOW
    }
  );
}

function makeDevice(
  overrides: { ipAddress?: IPAddress | null } = {}
): Device {
  return Device.reconstitute(DeviceId.parse(DEVICE_UUID).value, {
    deviceModelId: DeviceModelId.parse(MODEL_UUID).value,
    locationId: null,
    status: DeviceStatus.reconstitute(DeviceStatus.ACTIVE),
    category: null,
    ownerType: DeviceOwnerType.COMPANY,
    name: DeviceName.reconstitute('CPE-Cliente-01'),
    serialNumber: null,
    macAddress: null,
    ipAddress:
      overrides.ipAddress !== undefined
        ? overrides.ipAddress
        : IPAddress.create(CUSTOMER_IP).value,
    description: null,
    installedDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    monitoringEnabled: false
  });
}

function makeSetup() {
  const serviceRepo = makeServiceRepo();
  const deviceRepo = makeDeviceRepo();
  const routerResolver = {
    resolve: jest.fn()
  } as unknown as jest.Mocked<EnforcementRouterResolver>;
  const routerQueueService: jest.Mocked<IRouterQueueService> = {
    listSuspensionQueues: jest.fn(),
    addSuspensionQueue: jest.fn(),
    removeSuspensionQueue: jest.fn()
  };
  const useCase = new EnforceSuspensionUseCase(
    serviceRepo,
    deviceRepo,
    routerResolver,
    routerQueueService,
    makeLogger()
  );
  return {
    useCase,
    serviceRepo,
    deviceRepo,
    routerResolver,
    routerQueueService
  };
}

describe('EnforceSuspensionUseCase', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Happy Path', () => {
    it('should add a 1k queue named after the contracted service targeting the device IP', async () => {
      const setup = makeSetup();
      setup.serviceRepo.findById.mockResolvedValue(
        Result.ok(makeService())
      );
      setup.deviceRepo.findById.mockResolvedValue(
        Result.ok(makeDevice())
      );
      setup.routerResolver.resolve.mockResolvedValue(
        Result.ok(ROUTER_CONNECTION)
      );
      setup.routerQueueService.addSuspensionQueue.mockResolvedValue(
        Result.ok()
      );

      const result = await setup.useCase.execute({
        contractedServiceId: CS_UUID
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({
        contractedServiceId: CS_UUID,
        queueName: `suspend-${CS_UUID}`,
        targetIp: CUSTOMER_IP
      });
      expect(
        setup.routerQueueService.addSuspensionQueue
      ).toHaveBeenCalledWith(ROUTER_CONNECTION, {
        name: `suspend-${CS_UUID}`,
        targetIp: CUSTOMER_IP
      });
    });
  });

  describe('Business rule failures', () => {
    it('should fail when the service is not suspended', async () => {
      const setup = makeSetup();
      setup.serviceRepo.findById.mockResolvedValue(
        Result.ok(
          makeService({ status: ContractedServiceStatus.ACTIVE })
        )
      );

      const result = await setup.useCase.execute({
        contractedServiceId: CS_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not suspended');
      expect(
        setup.routerQueueService.addSuspensionQueue
      ).not.toHaveBeenCalled();
    });

    it('should fail when the service has no device assigned', async () => {
      const setup = makeSetup();
      setup.serviceRepo.findById.mockResolvedValue(
        Result.ok(makeService({ deviceId: null }))
      );

      const result = await setup.useCase.execute({
        contractedServiceId: CS_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('no device assigned');
    });

    it('should fail when the device has no IP address', async () => {
      const setup = makeSetup();
      setup.serviceRepo.findById.mockResolvedValue(
        Result.ok(makeService())
      );
      setup.deviceRepo.findById.mockResolvedValue(
        Result.ok(makeDevice({ ipAddress: null }))
      );

      const result = await setup.useCase.execute({
        contractedServiceId: CS_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('no IP address');
    });
  });

  describe('Missing entities and validation', () => {
    it('should fail when contractedServiceId is missing', async () => {
      const setup = makeSetup();

      const result = await setup.useCase.execute({
        contractedServiceId: ''
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'contractedServiceId is required'
      );
    });

    it('should fail when the contracted service does not exist', async () => {
      const setup = makeSetup();
      setup.serviceRepo.findById.mockResolvedValue(Result.ok(null));

      const result = await setup.useCase.execute({
        contractedServiceId: CS_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Contracted service not found');
    });

    it('should fail when the customer device does not exist', async () => {
      const setup = makeSetup();
      setup.serviceRepo.findById.mockResolvedValue(
        Result.ok(makeService())
      );
      setup.deviceRepo.findById.mockResolvedValue(Result.ok(null));

      const result = await setup.useCase.execute({
        contractedServiceId: CS_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Customer device not found');
    });
  });

  describe('Router failures', () => {
    it('should fail when the router connection cannot be resolved', async () => {
      const setup = makeSetup();
      setup.serviceRepo.findById.mockResolvedValue(
        Result.ok(makeService())
      );
      setup.deviceRepo.findById.mockResolvedValue(
        Result.ok(makeDevice())
      );
      setup.routerResolver.resolve.mockResolvedValue(
        Result.fail('Enforcement router device not found')
      );

      const result = await setup.useCase.execute({
        contractedServiceId: CS_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Enforcement router device not found'
      );
    });

    it('should fail when the router is unreachable', async () => {
      const setup = makeSetup();
      setup.serviceRepo.findById.mockResolvedValue(
        Result.ok(makeService())
      );
      setup.deviceRepo.findById.mockResolvedValue(
        Result.ok(makeDevice())
      );
      setup.routerResolver.resolve.mockResolvedValue(
        Result.ok(ROUTER_CONNECTION)
      );
      setup.routerQueueService.addSuspensionQueue.mockResolvedValue(
        Result.fail('RouterOS API error: connection timed out')
      );

      const result = await setup.useCase.execute({
        contractedServiceId: CS_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Failed to add suspension queue'
      );
    });
  });
});
