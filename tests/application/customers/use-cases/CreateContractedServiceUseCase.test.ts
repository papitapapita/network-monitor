// Source: src/application/customers/use-cases/CreateContractedServiceUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { CreateContractedServiceUseCase } from '../../../../src/application/customers/use-cases/CreateContractedServiceUseCase';
import {
  ICustomerRepository,
  IServicePlanRepository,
  IContractedServiceRepository
} from '../../../../src/domain/customers/repository';
import { ContractedService } from '../../../../src/domain/customers';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const CUSTOMER_UUID = '550e8400-e29b-41d4-a716-446655440001';
const PLAN_UUID = '550e8400-e29b-41d4-a716-446655440002';
const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440003';

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
    findAll: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    count: jest.fn()
  };
}

function makeCustomerRepo(): jest.Mocked<ICustomerRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByPhone: jest.fn(),
    findByCedula: jest.fn(),
    findByEmail: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    existsByPhone: jest.fn(),
    existsByCedula: jest.fn(),
    existsByEmail: jest.fn(),
    count: jest.fn()
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

describe('CreateContractedServiceUseCase', () => {
  let serviceRepo: jest.Mocked<IContractedServiceRepository>;
  let customerRepo: jest.Mocked<ICustomerRepository>;
  let planRepo: jest.Mocked<IServicePlanRepository>;
  let useCase: CreateContractedServiceUseCase;

  beforeEach(() => {
    serviceRepo = makeServiceRepo();
    customerRepo = makeCustomerRepo();
    planRepo = makePlanRepo();
    useCase = new CreateContractedServiceUseCase(
      serviceRepo,
      customerRepo,
      planRepo,
      makeLogger()
    );
    (customerRepo.exists as any).mockResolvedValue(Result.ok(true));
    (planRepo.exists as any).mockResolvedValue(Result.ok(true));
    (serviceRepo.findByDeviceId as any).mockResolvedValue(
      Result.ok(null)
    );
    (serviceRepo.save as any).mockImplementation(
      async (s: ContractedService) => Result.ok(s)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a PENDING service without a device', async () => {
    const result = await useCase.execute({
      customerId: CUSTOMER_UUID,
      servicePlanId: PLAN_UUID
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('PENDING');
    expect(result.value.deviceId).toBeNull();
  });

  it('should fail when the customer does not exist', async () => {
    (customerRepo.exists as any).mockResolvedValue(Result.ok(false));
    const result = await useCase.execute({
      customerId: CUSTOMER_UUID,
      servicePlanId: PLAN_UUID
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Customer not found');
  });

  it('should fail when the service plan does not exist', async () => {
    (planRepo.exists as any).mockResolvedValue(Result.ok(false));
    const result = await useCase.execute({
      customerId: CUSTOMER_UUID,
      servicePlanId: PLAN_UUID
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Service plan not found');
  });

  it('should reject a device already assigned elsewhere', async () => {
    (serviceRepo.findByDeviceId as any).mockResolvedValue(
      Result.ok(
        ContractedService.create({
          customerId: CUSTOMER_UUID as any,
          servicePlanId: PLAN_UUID as any,
          deviceId: null,
          startDate: new Date()
        }).value
      )
    );
    const result = await useCase.execute({
      customerId: CUSTOMER_UUID,
      servicePlanId: PLAN_UUID,
      deviceId: DEVICE_UUID
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('already assigned');
  });

  it('should reject an invalid startDate', async () => {
    const result = await useCase.execute({
      customerId: CUSTOMER_UUID,
      servicePlanId: PLAN_UUID,
      startDate: 'not-a-date'
    });
    expect(result.isFailure).toBe(true);
  });
});
