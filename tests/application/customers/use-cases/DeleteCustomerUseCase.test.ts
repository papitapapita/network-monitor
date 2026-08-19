// Source: src/application/customers/use-cases/DeleteCustomerUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { DeleteCustomerUseCase } from '../../../../src/application/customers/use-cases/DeleteCustomerUseCase';
import {
  ICustomerRepository,
  IContractedServiceRepository
} from '../../../../src/domain/customers/repository';
import {
  Customer,
  PhoneNumber,
  ContractedService
} from '../../../../src/domain/customers';
import {
  CustomerId,
  ServicePlanId
} from '../../../../src/domain/shared/ids';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
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

function makeCustomer(): Customer {
  return Customer.reconstitute(CustomerId.parse(VALID_UUID).value, {
    fullName: 'Juan Perez',
    phone: PhoneNumber.reconstitute('3001234567'),
    email: null,
    cedula: null,
    createdAt: NOW,
    updatedAt: NOW
  });
}

describe('DeleteCustomerUseCase', () => {
  let customerRepo: jest.Mocked<ICustomerRepository>;
  let serviceRepo: jest.Mocked<IContractedServiceRepository>;
  let useCase: DeleteCustomerUseCase;

  beforeEach(() => {
    customerRepo = makeCustomerRepo();
    serviceRepo = makeServiceRepo();
    useCase = new DeleteCustomerUseCase(
      customerRepo,
      serviceRepo,
      makeLogger()
    );
    (customerRepo.findById as any).mockResolvedValue(
      Result.ok(makeCustomer())
    );
    (serviceRepo.findByCustomerId as any).mockResolvedValue(
      Result.ok([])
    );
    (customerRepo.delete as any).mockResolvedValue(
      Result.ok(undefined)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should delete a customer with no contracted services', async () => {
    const result = await useCase.execute({ id: VALID_UUID });
    expect(result.isSuccess).toBe(true);
    expect(customerRepo.delete).toHaveBeenCalledTimes(1);
  });

  it('should refuse to delete a customer that still has services', async () => {
    const service = ContractedService.create({
      customerId: CustomerId.parse(VALID_UUID).value,
      servicePlanId: ServicePlanId.create(),
      deviceId: null,
      startDate: NOW
    }).value;
    (serviceRepo.findByCustomerId as any).mockResolvedValue(
      Result.ok([service])
    );

    const result = await useCase.execute({ id: VALID_UUID });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Cannot delete');
    expect(customerRepo.delete).not.toHaveBeenCalled();
  });

  it('should fail for an unknown customer', async () => {
    (customerRepo.findById as any).mockResolvedValue(Result.ok(null));
    const result = await useCase.execute({ id: VALID_UUID });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('not found');
  });
});
