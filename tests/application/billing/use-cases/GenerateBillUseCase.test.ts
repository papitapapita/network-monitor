// Source: src/application/billing/use-cases/GenerateBillUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { GenerateBillUseCase } from '../../../../src/application/billing/use-cases/GenerateBillUseCase';
import { IBillRepository } from '../../../../src/domain/billing/repository';
import {
  ICustomerRepository,
  IServicePlanRepository,
  IContractedServiceRepository
} from '../../../../src/domain/customers/repository';
import {
  ContractedService,
  ContractedServiceStatus,
  ServicePlan
} from '../../../../src/domain/customers';
import {
  BillId,
  CustomerId,
  ServicePlanId,
  DeviceId
} from '../../../../src/domain/shared/ids';
import {
  Bill,
  BillLineItem,
  BillStatus,
  BillingPeriod
} from '../../../../src/domain/billing';
import { Money } from '../../../../src/domain/shared/value-objects';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const CUSTOMER_UUID = '550e8400-e29b-41d4-a716-446655440001';
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
    exists: jest.fn(),
    findPendingDueBefore: jest.fn(),
    findCustomersOverdueBefore: jest.fn()
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

function makeActiveService(
  customerId: CustomerId,
  servicePlanId: ServicePlanId,
  startDate: Date = NOW
): ContractedService {
  return ContractedService.create({
    customerId,
    servicePlanId,
    deviceId: DeviceId.create(),
    status: ContractedServiceStatus.ACTIVE,
    startDate
  }).value;
}

function makeLastMonthBill(
  customerId: CustomerId,
  service: ContractedService,
  status: BillStatus
): Bill {
  return Bill.reconstitute(BillId.create(), {
    customerId,
    period: BillingPeriod.create(2024, 2).value,
    status,
    lineItems: [
      BillLineItem.create({
        contractedServiceId: service.id,
        servicePlanId: service.servicePlanId,
        planName: 'Fiber 50/10',
        monthlyPrice: Money.create(19990).value
      }).value
    ],
    issueDate: NOW,
    dueDate: NOW,
    paidAt: status === BillStatus.PAID ? NOW : null,
    createdAt: NOW,
    updatedAt: NOW
  });
}

function makePlan(
  overrides: Record<string, unknown> = {}
): ServicePlan {
  return ServicePlan.create({
    name: 'Fiber 50/10',
    downloadMbps: 50,
    uploadMbps: 10,
    monthlyPrice: 19990,
    description: null,
    ...overrides
  }).value;
}

describe('GenerateBillUseCase', () => {
  let billRepo: jest.Mocked<IBillRepository>;
  let customerRepo: jest.Mocked<ICustomerRepository>;
  let serviceRepo: jest.Mocked<IContractedServiceRepository>;
  let planRepo: jest.Mocked<IServicePlanRepository>;
  let useCase: GenerateBillUseCase;
  let customerId: CustomerId;

  beforeEach(() => {
    billRepo = makeBillRepo();
    customerRepo = makeCustomerRepo();
    serviceRepo = makeServiceRepo();
    planRepo = makePlanRepo();
    useCase = new GenerateBillUseCase(
      billRepo,
      customerRepo,
      serviceRepo,
      planRepo,
      makeLogger()
    );
    customerId = CustomerId.parse(CUSTOMER_UUID).value;

    (customerRepo.exists as any).mockResolvedValue(Result.ok(true));
    (billRepo.existsForCustomerAndPeriod as any).mockResolvedValue(
      Result.ok(false)
    );
    (billRepo.save as any).mockImplementation(async (b: unknown) =>
      Result.ok(b)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should snapshot planName + monthlyPrice for each active service and compute the exact total', async () => {
    const planA = makePlan({ name: 'Fiber 50', monthlyPrice: 19990 });
    const planB = makePlan({
      name: 'Fiber 100',
      monthlyPrice: 25000.75
    });
    const serviceA = makeActiveService(customerId, planA.id);
    const serviceB = makeActiveService(customerId, planB.id);

    (serviceRepo.findByCustomerId as any).mockResolvedValue(
      Result.ok([serviceA, serviceB])
    );
    (planRepo.findById as any).mockImplementation(
      async (id: ServicePlanId) => {
        if (id.equals(planA.id)) return Result.ok(planA);
        if (id.equals(planB.id)) return Result.ok(planB);
        return Result.ok(null);
      }
    );

    const result = await useCase.execute({
      customerId: CUSTOMER_UUID,
      year: 2024,
      month: 3
    });

    expect(result.isSuccess).toBe(true);
    const dto = result.value;
    expect(dto.lineItems).toHaveLength(2);
    expect(dto.lineItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          planName: 'Fiber 50',
          monthlyPrice: 19990
        }),
        expect.objectContaining({
          planName: 'Fiber 100',
          monthlyPrice: 25000.75
        })
      ])
    );
    expect(dto.total).toBe(44990.75);
    expect(dto.status).toBe('PENDING');
    expect(billRepo.save).toHaveBeenCalledTimes(1);
  });

  it('[BIL-291] a bill made by hand charges every active service the whole month', async () => {
    const plan = makePlan({ monthlyPrice: 19990 });
    const service = makeActiveService(
      customerId,
      plan.id,
      new Date('2024-03-20T15:00:00.000Z')
    );
    (serviceRepo.findByCustomerId as any).mockResolvedValue(
      Result.ok([service])
    );
    (planRepo.findById as any).mockResolvedValue(Result.ok(plan));

    const result = await useCase.execute({
      customerId: CUSTOMER_UUID,
      year: 2024,
      month: 3
    });

    expect(result.value.lineItems[0]).toMatchObject({
      monthlyPrice: 19990,
      amount: 19990,
      serviceFrom: '2024-03-01',
      serviceTo: '2024-03-31'
    });
    expect(billRepo.findAll).not.toHaveBeenCalled();
  });

  describe('prorated (automatic run)', () => {
    const PRORATION = {
      billingMode: 'ADVANCE',
      previousIssueDay: '2024-02-10'
    };
    let plan: ServicePlan;

    function startedOn(iso: string): ContractedService {
      const service = makeActiveService(
        customerId,
        plan.id,
        new Date(iso)
      );
      (serviceRepo.findByCustomerId as any).mockResolvedValue(
        Result.ok([service])
      );
      return service;
    }

    function run(proration: Record<string, string> = PRORATION) {
      return useCase.execute({
        customerId: CUSTOMER_UUID,
        year: 2024,
        month: 3,
        proration: proration as any
      });
    }

    beforeEach(() => {
      plan = makePlan({ monthlyPrice: 19990 });
      (planRepo.findById as any).mockResolvedValue(Result.ok(plan));
      (billRepo.findAll as any).mockResolvedValue(Result.ok([]));
    });

    it('[BIL-288] charges a service that started inside the month from its first day', async () => {
      // 20 Mar in Bogotá: 12 of March's 31 days.
      startedOn('2024-03-20T15:00:00.000Z');

      const result = await run();

      expect(result.value.lineItems[0]).toMatchObject({
        monthlyPrice: 19990,
        amount: 7738,
        serviceFrom: '2024-03-20',
        serviceTo: '2024-03-31'
      });
      expect(result.value.total).toBe(7738);
    });

    it("[BIL-289] adds last month's days for a service started after last month's issue day and on no bill for it", async () => {
      // 20 Feb 2024: 10 of February's 29 days.
      startedOn('2024-02-20T15:00:00.000Z');

      const result = await run();

      expect(
        billRepo.findAll.mock.calls[0][0]!.period!.toString()
      ).toBe('2024-02');
      expect(result.value.lineItems[0]).toMatchObject({
        amount: 19990 + 6893,
        serviceFrom: '2024-02-20',
        serviceTo: '2024-03-31'
      });
    });

    it("[BIL-289] does not charge last month's days again when last month's bill holds the service", async () => {
      const service = startedOn('2024-02-20T15:00:00.000Z');
      (billRepo.findAll as any).mockResolvedValue(
        Result.ok([
          makeLastMonthBill(customerId, service, BillStatus.PAID)
        ])
      );

      const result = await run();

      expect(result.value.lineItems[0]).toMatchObject({
        amount: 19990,
        serviceFrom: '2024-03-01'
      });
    });

    it('[BIL-289] a cancelled bill for last month does not count as billed', async () => {
      const service = startedOn('2024-02-20T15:00:00.000Z');
      (billRepo.findAll as any).mockResolvedValue(
        Result.ok([
          makeLastMonthBill(customerId, service, BillStatus.CANCELLED)
        ])
      );

      const result = await run();

      expect(result.value.lineItems[0].serviceFrom).toBe(
        '2024-02-20'
      );
    });

    it("[BIL-289] paid after use, last month's days are never added", async () => {
      startedOn('2024-02-20T15:00:00.000Z');

      const result = await run({
        billingMode: 'ARREARS',
        previousIssueDay: '2024-02-10'
      });

      expect(billRepo.findAll).not.toHaveBeenCalled();
      expect(result.value.lineItems[0]).toMatchObject({
        amount: 19990,
        serviceFrom: '2024-03-01'
      });
    });

    it('[BIL-287] fails when every service starts after the month', async () => {
      startedOn('2024-04-02T15:00:00.000Z');

      const result = await run();

      expect(result.error).toBe(
        'Customer has no services to bill for period 2024-03'
      );
      expect(billRepo.save).not.toHaveBeenCalled();
    });

    it('rejects an unknown billing mode', async () => {
      startedOn('2024-03-20T15:00:00.000Z');

      const result = await run({
        billingMode: 'WEEKLY',
        previousIssueDay: '2024-02-10'
      });

      expect(result.error).toBe(
        'billingMode must be one of ADVANCE, ARREARS'
      );
    });

    it('rejects a malformed previous issue day', async () => {
      startedOn('2024-03-20T15:00:00.000Z');

      const result = await run({
        billingMode: 'ADVANCE',
        previousIssueDay: '10/02/2024'
      });

      expect(result.error).toBe(
        'previousIssueDay must be a YYYY-MM-DD date'
      );
    });
  });

  it('should fail when the customer does not exist', async () => {
    (customerRepo.exists as any).mockResolvedValue(Result.ok(false));

    const result = await useCase.execute({
      customerId: CUSTOMER_UUID,
      year: 2024,
      month: 3
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Customer not found');
    expect(billRepo.save).not.toHaveBeenCalled();
  });

  it('should fail when a non-cancelled bill already exists for the period', async () => {
    (billRepo.existsForCustomerAndPeriod as any).mockResolvedValue(
      Result.ok(true)
    );

    const result = await useCase.execute({
      customerId: CUSTOMER_UUID,
      year: 2024,
      month: 3
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('already exists');
    expect(billRepo.save).not.toHaveBeenCalled();
  });

  it('should fail when the customer has no contracted services at all', async () => {
    (serviceRepo.findByCustomerId as any).mockResolvedValue(
      Result.ok([])
    );

    const result = await useCase.execute({
      customerId: CUSTOMER_UUID,
      year: 2024,
      month: 3
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(
      'Customer has no active contracted services for billing'
    );
    expect(billRepo.save).not.toHaveBeenCalled();
  });

  it('should fail when all contracted services are SUSPENDED', async () => {
    const plan = makePlan();
    const service = makeActiveService(customerId, plan.id);
    service.suspend();

    (serviceRepo.findByCustomerId as any).mockResolvedValue(
      Result.ok([service])
    );

    const result = await useCase.execute({
      customerId: CUSTOMER_UUID,
      year: 2024,
      month: 3
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(
      'Customer has no active contracted services for billing'
    );
    expect(billRepo.save).not.toHaveBeenCalled();
  });

  it('should fail the whole generation when a referenced service plan is missing', async () => {
    const plan = makePlan();
    const service = makeActiveService(customerId, plan.id);

    (serviceRepo.findByCustomerId as any).mockResolvedValue(
      Result.ok([service])
    );
    (planRepo.findById as any).mockResolvedValue(Result.ok(null));

    const result = await useCase.execute({
      customerId: CUSTOMER_UUID,
      year: 2024,
      month: 3
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Data integrity error');
    expect(result.error).toContain('does not exist');
    expect(billRepo.save).not.toHaveBeenCalled();
  });

  it('should propagate a repository save failure', async () => {
    const plan = makePlan();
    const service = makeActiveService(customerId, plan.id);

    (serviceRepo.findByCustomerId as any).mockResolvedValue(
      Result.ok([service])
    );
    (planRepo.findById as any).mockResolvedValue(Result.ok(plan));
    (billRepo.save as any).mockResolvedValue(
      Result.fail('DB write failed')
    );

    const result = await useCase.execute({
      customerId: CUSTOMER_UUID,
      year: 2024,
      month: 3
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Failed to persist bill');
    expect(result.error).toContain('DB write failed');
  });
});
