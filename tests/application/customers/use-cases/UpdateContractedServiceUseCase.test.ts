// Source: src/application/customers/use-cases/UpdateContractedServiceUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { UpdateContractedServiceUseCase } from '../../../../src/application/customers/use-cases/UpdateContractedServiceUseCase';
import {
  IServicePlanRepository,
  IContractedServiceRepository
} from '../../../../src/domain/customers/repository';
import {
  ContractedService,
  ContractedServiceStatus,
  PaymentDay
} from '../../../../src/domain/customers';
import {
  ContractedServiceId,
  CustomerId,
  ServicePlanId,
  DeviceId
} from '../../../../src/domain/shared/ids';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const CS_UUID = '550e8400-e29b-41d4-a716-446655440000';
const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440003';
const NOW = new Date('2024-01-01T00:00:00.000Z');

function makeLogger(): jest.Mocked<ILogger> {
  const child: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn(),
    setLevel: jest.fn()
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
    delete: jest.fn(),
    exists: jest.fn()
  };
}

function makePlanRepo(): jest.Mocked<IServicePlanRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    count: jest.fn()
  };
}

function makeService(
  status: ContractedServiceStatus,
  deviceId: DeviceId | null
): ContractedService {
  return ContractedService.reconstitute(
    ContractedServiceId.parse(CS_UUID).value,
    {
      customerId: CustomerId.create(),
      servicePlanId: ServicePlanId.create(),
      deviceId,
      status,
      startDate: NOW,
      paymentDay: PaymentDay.default(),
      createdAt: NOW,
      updatedAt: NOW
    }
  );
}

describe('UpdateContractedServiceUseCase', () => {
  let serviceRepo: jest.Mocked<IContractedServiceRepository>;
  let planRepo: jest.Mocked<IServicePlanRepository>;
  let useCase: UpdateContractedServiceUseCase;

  beforeEach(() => {
    serviceRepo = makeServiceRepo();
    planRepo = makePlanRepo();
    useCase = new UpdateContractedServiceUseCase(
      serviceRepo,
      planRepo,
      makeLogger()
    );
    (serviceRepo.findByDeviceId as any).mockResolvedValue(
      Result.ok(null)
    );
    (planRepo.exists as any).mockResolvedValue(Result.ok(true));
    (serviceRepo.save as any).mockImplementation(
      async (s: ContractedService) => Result.ok(s)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should reject an invalid target status', async () => {
    (serviceRepo.findById as any).mockResolvedValue(
      Result.ok(makeService(ContractedServiceStatus.PENDING, null))
    );
    const result = await useCase.execute({
      id: CS_UUID,
      status: 'PENDING'
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid target status');
  });

  it('[CUS-024] should move the service to the 15th group', async () => {
    (serviceRepo.findById as any).mockResolvedValue(
      Result.ok(
        makeService(ContractedServiceStatus.ACTIVE, DeviceId.create())
      )
    );
    const result = await useCase.execute({
      id: CS_UUID,
      paymentDay: 15
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value.paymentDay).toBe(15);
    expect(serviceRepo.save).toHaveBeenCalledTimes(1);
  });

  it('[CUS-024] should reject a payment day outside 15 and 30', async () => {
    (serviceRepo.findById as any).mockResolvedValue(
      Result.ok(
        makeService(ContractedServiceStatus.ACTIVE, DeviceId.create())
      )
    );
    const result = await useCase.execute({
      id: CS_UUID,
      paymentDay: 31
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Payment day must be one of 15, 30');
    expect(serviceRepo.save).not.toHaveBeenCalled();
  });

  it('should assign a device and activate in one call', async () => {
    (serviceRepo.findById as any).mockResolvedValue(
      Result.ok(makeService(ContractedServiceStatus.PENDING, null))
    );
    const result = await useCase.execute({
      id: CS_UUID,
      deviceId: DEVICE_UUID,
      status: 'ACTIVE'
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('ACTIVE');
    expect(result.value.deviceId).toBe(DEVICE_UUID);
  });

  it('should fail to activate without a device', async () => {
    (serviceRepo.findById as any).mockResolvedValue(
      Result.ok(makeService(ContractedServiceStatus.PENDING, null))
    );
    const result = await useCase.execute({
      id: CS_UUID,
      status: 'ACTIVE'
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('without a device');
  });

  it('should suspend an active service and release its device in one call', async () => {
    (serviceRepo.findById as any).mockResolvedValue(
      Result.ok(
        makeService(
          ContractedServiceStatus.ACTIVE,
          DeviceId.parse(DEVICE_UUID).value
        )
      )
    );
    const result = await useCase.execute({
      id: CS_UUID,
      status: 'SUSPENDED',
      deviceId: null
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('SUSPENDED');
    expect(result.value.deviceId).toBeNull();
  });

  it('should refuse to modify a cancelled service', async () => {
    (serviceRepo.findById as any).mockResolvedValue(
      Result.ok(makeService(ContractedServiceStatus.CANCELLED, null))
    );
    const result = await useCase.execute({
      id: CS_UUID,
      status: 'ACTIVE'
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('cancelled');
  });

  it('should reject a device already owned by another service', async () => {
    (serviceRepo.findById as any).mockResolvedValue(
      Result.ok(makeService(ContractedServiceStatus.PENDING, null))
    );
    // A *different* service (distinct id) already owns the device.
    const otherOwner = ContractedService.reconstitute(
      ContractedServiceId.create(),
      {
        customerId: CustomerId.create(),
        servicePlanId: ServicePlanId.create(),
        deviceId: DeviceId.parse(DEVICE_UUID).value,
        status: ContractedServiceStatus.ACTIVE,
        startDate: NOW,
        paymentDay: PaymentDay.default(),
        createdAt: NOW,
        updatedAt: NOW
      }
    );
    (serviceRepo.findByDeviceId as any).mockResolvedValue(
      Result.ok(otherOwner)
    );
    const result = await useCase.execute({
      id: CS_UUID,
      deviceId: DEVICE_UUID
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('already assigned');
  });
});
