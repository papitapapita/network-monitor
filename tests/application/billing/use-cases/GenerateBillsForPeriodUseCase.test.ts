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
  ContractedServiceStatus,
  PaymentDay
} from '../../../../src/domain/customers';
import {
  ContractedServiceId,
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
    existsForServiceAndPeriod: jest.fn(),
    exists: jest.fn(),
    findPendingDueBefore: jest.fn(),
    findOverdueDueBetween: jest.fn(),
    findServicesOverdueBefore: jest.fn()
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
    delete: jest.fn(),
    exists: jest.fn()
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
    startDate: NOW,
    paymentDay: PaymentDay.default()
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
    payment: null,
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

    (billRepo.existsForServiceAndPeriod as any).mockResolvedValue(
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

  it('[BIL-084] should bill each active service on its own, even two of one customer', async () => {
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
    expect(result.value.generated).toHaveLength(2);
    expect(
      generateBillUseCase.execute.mock.calls.map(
        ([req]) => req.contractedServiceId
      )
    ).toEqual([serviceA.id.toString(), serviceB.id.toString()]);
  });

  it('should partition services into generated, skipped, and failed — and keep going past a failure', async () => {
    const customerId = CustomerId.create();
    const serviceA = makeActiveService(customerId);
    const serviceB = makeActiveService(customerId);
    const serviceC = makeActiveService(customerId);
    const serviceD = makeActiveService(customerId);

    (serviceRepo.findByStatus as any).mockResolvedValue(
      Result.ok([serviceA, serviceB, serviceC, serviceD])
    );

    (billRepo.existsForServiceAndPeriod as any).mockImplementation(
      async (serviceId: ContractedServiceId) =>
        Result.ok(serviceId.equals(serviceB.id))
    );

    generateBillUseCase.execute.mockImplementation(async (req) => {
      if (req.contractedServiceId === serviceC.id.toString()) {
        return Result.fail(
          'Contracted service is not active and cannot be billed'
        );
      }
      return Result.ok(makeBillDTO(customerId.toString()));
    });

    const result = await useCase.execute({
      year: YEAR,
      month: MONTH
    });

    expect(result.isSuccess).toBe(true);
    const dto = result.value;
    expect(dto.period).toBe('2024-03');
    expect(dto.generated).toHaveLength(2);

    expect(dto.skipped).toEqual([
      {
        contractedServiceId: serviceB.id.toString(),
        reason: expect.stringContaining('already exists')
      }
    ]);

    expect(dto.failed).toEqual([
      {
        contractedServiceId: serviceC.id.toString(),
        error: 'Contracted service is not active and cannot be billed'
      }
    ]);

    // The loop must not have aborted after serviceC's failure.
    expect(generateBillUseCase.execute).toHaveBeenCalledTimes(3);
  });
});
