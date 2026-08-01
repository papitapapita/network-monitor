// Source: src/infrastructure/service-enforcement/orchestrator/SuspensionReconciliationOrchestrator.ts

import { SuspensionReconciliationOrchestrator } from '../../../../src/infrastructure/service-enforcement/orchestrator/SuspensionReconciliationOrchestrator';
import { EnforcementRouterResolver } from '../../../../src/application/service-enforcement/services/EnforcementRouterResolver';
import {
  IRouterQueueService,
  RouterConnection,
  SuspensionQueue
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

const CS_UUID = '550e8400-e29b-41d4-a716-4466554400a1';
const DEVICE_UUID = '550e8400-e29b-41d4-a716-4466554400a2';
const MODEL_UUID = '550e8400-e29b-41d4-a716-4466554400a3';
const CUSTOMER_IP = '10.20.30.40';
const NOW = new Date('2024-06-01T00:00:00.000Z');
const QUEUE_NAME = `suspend-${CS_UUID}`;

const ROUTER_CONNECTION: RouterConnection = {
  host: '10.0.0.1',
  port: 8728,
  username: 'api',
  password: 'secret'
};

function makeLogger(): jest.Mocked<ILogger> {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(),
    setLevel: jest.fn(),
    child: jest.fn().mockReturnThis()
  } as unknown as jest.Mocked<ILogger>;
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
    findByFilters: jest.fn(),
    countByFilters: jest.fn()
  };
}

function makeSuspendedService(
  csUuid: string = CS_UUID,
  deviceId: DeviceId | null = DeviceId.parse(DEVICE_UUID).value
): ContractedService {
  return ContractedService.reconstitute(
    ContractedServiceId.parse(csUuid).value,
    {
      customerId: CustomerId.create(),
      servicePlanId: ServicePlanId.create(),
      deviceId,
      status: ContractedServiceStatus.SUSPENDED,
      startDate: NOW,
      createdAt: NOW,
      updatedAt: NOW
    }
  );
}

function makeDevice(ip: string = CUSTOMER_IP): Device {
  return Device.reconstitute(DeviceId.parse(DEVICE_UUID).value, {
    deviceModelId: DeviceModelId.parse(MODEL_UUID).value,
    locationId: null,
    status: DeviceStatus.reconstitute(DeviceStatus.ACTIVE),
    category: null,
    ownerType: DeviceOwnerType.COMPANY,
    name: DeviceName.reconstitute('CPE-Cliente-01'),
    serialNumber: null,
    macAddress: null,
    ipAddress: IPAddress.create(ip).value,
    description: null,
    installedDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    monitoringEnabled: false
  });
}

function makeSetup(actualQueues: SuspensionQueue[] = []) {
  const serviceRepo = makeServiceRepo();
  const deviceRepo = makeDeviceRepo();
  const routerResolver = {
    resolve: jest.fn().mockResolvedValue(Result.ok(ROUTER_CONNECTION))
  } as unknown as jest.Mocked<EnforcementRouterResolver>;
  const routerQueueService: jest.Mocked<IRouterQueueService> = {
    listSuspensionQueues: jest
      .fn()
      .mockResolvedValue(Result.ok(actualQueues)),
    addSuspensionQueue: jest.fn().mockResolvedValue(Result.ok()),
    removeSuspensionQueue: jest.fn().mockResolvedValue(Result.ok())
  };
  const orchestrator = new SuspensionReconciliationOrchestrator(
    serviceRepo,
    deviceRepo,
    routerResolver,
    routerQueueService,
    { checkIntervalMs: 60_000 },
    makeLogger()
  );
  return {
    orchestrator,
    serviceRepo,
    deviceRepo,
    routerResolver,
    routerQueueService
  };
}

describe('SuspensionReconciliationOrchestrator', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reconcile — convergence', () => {
    it('should add a queue missing for a suspended service', async () => {
      const setup = makeSetup([]);
      setup.serviceRepo.findByStatus.mockResolvedValue(
        Result.ok([makeSuspendedService()])
      );
      setup.deviceRepo.findById.mockResolvedValue(
        Result.ok(makeDevice())
      );

      await setup.orchestrator.reconcile();

      expect(
        setup.routerQueueService.addSuspensionQueue
      ).toHaveBeenCalledWith(ROUTER_CONNECTION, {
        name: QUEUE_NAME,
        targetIp: CUSTOMER_IP
      });
      expect(
        setup.routerQueueService.removeSuspensionQueue
      ).not.toHaveBeenCalled();
    });

    it('should do nothing when router state already matches', async () => {
      const setup = makeSetup([
        { name: QUEUE_NAME, targetIp: CUSTOMER_IP }
      ]);
      setup.serviceRepo.findByStatus.mockResolvedValue(
        Result.ok([makeSuspendedService()])
      );
      setup.deviceRepo.findById.mockResolvedValue(
        Result.ok(makeDevice())
      );

      await setup.orchestrator.reconcile();

      expect(
        setup.routerQueueService.addSuspensionQueue
      ).not.toHaveBeenCalled();
      expect(
        setup.routerQueueService.removeSuspensionQueue
      ).not.toHaveBeenCalled();
    });

    it('should remove a stale queue whose service is no longer suspended', async () => {
      const setup = makeSetup([
        { name: QUEUE_NAME, targetIp: CUSTOMER_IP }
      ]);
      setup.serviceRepo.findByStatus.mockResolvedValue(Result.ok([]));

      await setup.orchestrator.reconcile();

      expect(
        setup.routerQueueService.removeSuspensionQueue
      ).toHaveBeenCalledWith(ROUTER_CONNECTION, QUEUE_NAME);
      expect(
        setup.routerQueueService.addSuspensionQueue
      ).not.toHaveBeenCalled();
    });

    it('should recreate a queue whose target IP drifted', async () => {
      const setup = makeSetup([
        { name: QUEUE_NAME, targetIp: '192.168.99.99' }
      ]);
      setup.serviceRepo.findByStatus.mockResolvedValue(
        Result.ok([makeSuspendedService()])
      );
      setup.deviceRepo.findById.mockResolvedValue(
        Result.ok(makeDevice())
      );

      await setup.orchestrator.reconcile();

      expect(
        setup.routerQueueService.removeSuspensionQueue
      ).toHaveBeenCalledWith(ROUTER_CONNECTION, QUEUE_NAME);
      expect(
        setup.routerQueueService.addSuspensionQueue
      ).toHaveBeenCalledWith(ROUTER_CONNECTION, {
        name: QUEUE_NAME,
        targetIp: CUSTOMER_IP
      });
    });

    it('should skip suspended services without a device or IP', async () => {
      const setup = makeSetup([]);
      setup.serviceRepo.findByStatus.mockResolvedValue(
        Result.ok([makeSuspendedService(CS_UUID, null)])
      );

      await setup.orchestrator.reconcile();

      expect(setup.deviceRepo.findById).not.toHaveBeenCalled();
      expect(
        setup.routerQueueService.addSuspensionQueue
      ).not.toHaveBeenCalled();
    });
  });

  describe('reconcile — failure tolerance', () => {
    it('should abort the tick when the router connection cannot be resolved', async () => {
      const setup = makeSetup([]);
      setup.serviceRepo.findByStatus.mockResolvedValue(Result.ok([]));
      setup.routerResolver.resolve.mockResolvedValue(
        Result.fail('router device not found')
      );

      await setup.orchestrator.reconcile();

      expect(
        setup.routerQueueService.listSuspensionQueues
      ).not.toHaveBeenCalled();
    });

    it('should abort the tick when listing queues fails', async () => {
      const setup = makeSetup([]);
      setup.serviceRepo.findByStatus.mockResolvedValue(
        Result.ok([makeSuspendedService()])
      );
      setup.deviceRepo.findById.mockResolvedValue(
        Result.ok(makeDevice())
      );
      setup.routerQueueService.listSuspensionQueues.mockResolvedValue(
        Result.fail('RouterOS API error: timeout')
      );

      await setup.orchestrator.reconcile();

      expect(
        setup.routerQueueService.addSuspensionQueue
      ).not.toHaveBeenCalled();
    });

    it('should not throw when the service repository fails', async () => {
      const setup = makeSetup([]);
      setup.serviceRepo.findByStatus.mockResolvedValue(
        Result.fail('DB down')
      );

      await expect(
        setup.orchestrator.reconcile()
      ).resolves.toBeUndefined();
    });
  });

  describe('lifecycle', () => {
    it('start/stop should toggle isActive', async () => {
      const setup = makeSetup([]);
      setup.serviceRepo.findByStatus.mockResolvedValue(Result.ok([]));

      expect(setup.orchestrator.isActive()).toBe(false);
      setup.orchestrator.start();
      expect(setup.orchestrator.isActive()).toBe(true);
      await setup.orchestrator.stop();
      expect(setup.orchestrator.isActive()).toBe(false);
    });
  });
});
