// Source: src/application/notifications/use-cases/SendSuspensionNoticeUseCase.ts

import { SendSuspensionNoticeUseCase } from '../../../../src/application/notifications/use-cases/SendSuspensionNoticeUseCase';
import { ICustomerNotificationService } from '../../../../src/application/notifications/interfaces/ICustomerNotificationService';
import { IContractedServiceRepository } from '../../../../src/domain/customers/repository/IContractedServiceRepository';
import { ICustomerRepository } from '../../../../src/domain/customers/repository/ICustomerRepository';
import { ContractedService } from '../../../../src/domain/customers/aggregates/ContractedService';
import { Customer } from '../../../../src/domain/customers/aggregates/Customer';
import { ContractedServiceStatus } from '../../../../src/domain/customers/enums/ContractedServiceStatus';
import { PhoneNumber } from '../../../../src/domain/customers/value-objects/PhoneNumber';
import { ContractedServiceId } from '../../../../src/domain/shared/ids/ContractedServiceId';
import { CustomerId } from '../../../../src/domain/shared/ids/CustomerId';
import { ServicePlanId } from '../../../../src/domain/shared/ids/ServicePlanId';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

const CS_UUID = '550e8400-e29b-41d4-a716-446655440060';
const CUSTOMER_UUID = '550e8400-e29b-41d4-a716-446655440061';
const NOW = new Date('2024-06-01T10:00:00.000Z');

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

function makeService(): ContractedService {
  return ContractedService.reconstitute(
    ContractedServiceId.parse(CS_UUID).value,
    {
      customerId: CustomerId.parse(CUSTOMER_UUID).value,
      servicePlanId: ServicePlanId.create(),
      deviceId: null,
      status: ContractedServiceStatus.SUSPENDED,
      startDate: NOW,
      createdAt: NOW,
      updatedAt: NOW
    }
  );
}

function makeCustomer(): Customer {
  return Customer.reconstitute(
    CustomerId.parse(CUSTOMER_UUID).value,
    {
      fullName: 'Juan Perez',
      phone: PhoneNumber.reconstitute('+573001234567'),
      email: null,
      cedula: null,
      createdAt: NOW,
      updatedAt: NOW
    }
  );
}

function makeSetup() {
  const serviceRepo = makeServiceRepo();
  const customerRepo = makeCustomerRepo();
  const notificationService: jest.Mocked<ICustomerNotificationService> =
    {
      sendTemplate: jest.fn()
    };
  const useCase = new SendSuspensionNoticeUseCase(
    serviceRepo,
    customerRepo,
    notificationService,
    makeLogger()
  );
  return { useCase, serviceRepo, customerRepo, notificationService };
}

describe('SendSuspensionNoticeUseCase', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Happy Path', () => {
    it('should send the template to the customer phone with their name', async () => {
      const {
        useCase,
        serviceRepo,
        customerRepo,
        notificationService
      } = makeSetup();
      serviceRepo.findById.mockResolvedValue(
        Result.ok(makeService())
      );
      customerRepo.findById.mockResolvedValue(
        Result.ok(makeCustomer())
      );
      notificationService.sendTemplate.mockResolvedValue(Result.ok());

      const result = await useCase.execute({
        contractedServiceId: CS_UUID
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.contractedServiceId).toBe(CS_UUID);
      expect(result.value.customerId).toBe(CUSTOMER_UUID);

      expect(notificationService.sendTemplate).toHaveBeenCalledTimes(
        1
      );
      const [phone, message] =
        notificationService.sendTemplate.mock.calls[0];
      expect(phone.value).toBe('+573001234567');
      expect(message).toEqual({ bodyParams: ['Juan Perez'] });
    });
  });

  describe('Validation failures', () => {
    it('should fail when contractedServiceId is missing', async () => {
      const { useCase } = makeSetup();

      const result = await useCase.execute({
        contractedServiceId: ''
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'contractedServiceId is required'
      );
    });

    it('should fail when contractedServiceId is not a valid UUID', async () => {
      const { useCase } = makeSetup();

      const result = await useCase.execute({
        contractedServiceId: 'nope'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid contracted service ID');
    });
  });

  describe('Missing entities', () => {
    it('should fail when the contracted service does not exist', async () => {
      const { useCase, serviceRepo } = makeSetup();
      serviceRepo.findById.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({
        contractedServiceId: CS_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Contracted service not found');
    });

    it('should fail when the customer does not exist', async () => {
      const { useCase, serviceRepo, customerRepo } = makeSetup();
      serviceRepo.findById.mockResolvedValue(
        Result.ok(makeService())
      );
      customerRepo.findById.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({
        contractedServiceId: CS_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Customer not found');
    });
  });

  describe('Downstream failures', () => {
    it('should fail when the service repository fails', async () => {
      const { useCase, serviceRepo } = makeSetup();
      serviceRepo.findById.mockResolvedValue(Result.fail('DB down'));

      const result = await useCase.execute({
        contractedServiceId: CS_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Failed to load contracted service'
      );
    });

    it('should fail when the notification provider fails', async () => {
      const {
        useCase,
        serviceRepo,
        customerRepo,
        notificationService
      } = makeSetup();
      serviceRepo.findById.mockResolvedValue(
        Result.ok(makeService())
      );
      customerRepo.findById.mockResolvedValue(
        Result.ok(makeCustomer())
      );
      notificationService.sendTemplate.mockResolvedValue(
        Result.fail('WhatsApp API error: template rejected')
      );

      const result = await useCase.execute({
        contractedServiceId: CS_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Failed to send suspension notice'
      );
    });
  });
});
