// Source: src/application/billing/use-cases/GenerateBillsForPeriodUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { GenerateBillsForPeriodUseCase } from '../../../../src/application/billing/use-cases/GenerateBillsForPeriodUseCase';
import { GenerateBillUseCase } from '../../../../src/application/billing/use-cases/GenerateBillUseCase';
import { BillResponseDTO } from '../../../../src/application/billing/dtos';
import { IBillRepository } from '../../../../src/domain/billing/repository';
import { IContractedServiceRepository } from '../../../../src/domain/customers/repository';
import {
  ContractedService,
  ContractedServiceStatus
} from '../../../../src/domain/customers';
import {
  CustomerId,
  ServicePlanId,
  DeviceId,
  BillId
} from '../../../../src/domain/shared/ids';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const YEAR = 2024;
const MONTH = 3;
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

function makeBillRepo(): jest.Mocked<IBillRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByCustomerId: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
    existsForCustomerAndPeriod: jest.fn(),
    exists: jest.fn()
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

function makeGenerateBillUseCase(): jest.Mocked<GenerateBillUseCase> {
  return {
    execute: jest.fn()
  } as unknown as jest.Mocked<GenerateBillUseCase>;
}

function makeActiveService(
  customerId: CustomerId
): ContractedService {
  return ContractedService.create({
    customerId,
    servicePlanId: ServicePlanId.create(),
    deviceId: DeviceId.create(),
    status: ContractedServiceStatus.ACTIVE,
    startDate: NOW
  }).value;
}

function makeBillDTO(customerId: string): BillResponseDTO {
  return {
    id: BillId.create().toString(),
    customerId,
    period: '2024-03',
    status: 'PENDING',
    issueDate: NOW.toISOString(),
    dueDate: NOW.toISOString(),
    paidAt: null,
    total: 100,
    lineItems: [],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString()
  };
}

describe('GenerateBillsForPeriodUseCase', () => {
  let generateBillUseCase: jest.Mocked<GenerateBillUseCase>;
  let billRepo: jest.Mocked<IBillRepository>;
  let serviceRepo: jest.Mocked<IContractedServiceRepository>;
  let useCase: GenerateBillsForPeriodUseCase;

  beforeEach(() => {
    generateBillUseCase = makeGenerateBillUseCase();
    billRepo = makeBillRepo();
    serviceRepo = makeServiceRepo();
    useCase = new GenerateBillsForPeriodUseCase(
      generateBillUseCase,
      billRepo,
      serviceRepo,
      makeLogger()
    );

    (billRepo.existsForCustomerAndPeriod as any).mockResolvedValue(
      Result.ok(false)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should succeed with empty arrays when there are no active contracted services', async () => {
    (serviceRepo.findByStatus as any).mockResolvedValue(
      Result.ok([])
    );

    const result = await useCase.execute({
      year: YEAR,
      month: MONTH
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({
      period: '2024-03',
      generated: [],
      skipped: [],
      failed: []
    });
    expect(generateBillUseCase.execute).not.toHaveBeenCalled();
  });

  it('should delegate once per unique customer even with multiple active services', async () => {
    const customerId = CustomerId.create();
    const serviceA = makeActiveService(customerId);
    const serviceB = makeActiveService(customerId);

    (serviceRepo.findByStatus as any).mockResolvedValue(
      Result.ok([serviceA, serviceB])
    );
    generateBillUseCase.execute.mockResolvedValue(
      Result.ok(makeBillDTO(customerId.toString()))
    );

    const result = await useCase.execute({
      year: YEAR,
      month: MONTH
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.generated).toHaveLength(1);
    expect(generateBillUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it('should partition customers into generated, skipped, and failed — and keep going past a failure', async () => {
    const customerA = CustomerId.create();
    const customerB = CustomerId.create();
    const customerC = CustomerId.create();
    const customerD = CustomerId.create();

    (serviceRepo.findByStatus as any).mockResolvedValue(
      Result.ok([
        makeActiveService(customerA),
        makeActiveService(customerB),
        makeActiveService(customerC),
        makeActiveService(customerD)
      ])
    );

    (billRepo.existsForCustomerAndPeriod as any).mockImplementation(
      async (customerId: CustomerId) =>
        Result.ok(customerId.equals(customerB))
    );

    generateBillUseCase.execute.mockImplementation(async (req) => {
      if (req.customerId === customerC.toString()) {
        return Result.fail(
          'Customer has no active contracted services for billing'
        );
      }
      return Result.ok(makeBillDTO(req.customerId));
    });

    const result = await useCase.execute({
      year: YEAR,
      month: MONTH
    });

    expect(result.isSuccess).toBe(true);
    const dto = result.value;
    expect(dto.period).toBe('2024-03');

    expect(dto.generated.map((b) => b.customerId)).toEqual(
      expect.arrayContaining([
        customerA.toString(),
        customerD.toString()
      ])
    );
    expect(dto.generated).toHaveLength(2);

    expect(dto.skipped).toEqual([
      {
        customerId: customerB.toString(),
        reason: expect.stringContaining('already exists')
      }
    ]);

    expect(dto.failed).toEqual([
      {
        customerId: customerC.toString(),
        error:
          'Customer has no active contracted services for billing'
      }
    ]);

    // The loop must not have aborted after customerC's failure.
    expect(generateBillUseCase.execute).toHaveBeenCalledTimes(3);
  });
});
