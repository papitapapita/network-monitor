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
  IServicePlanRepository,
  IContractedServiceRepository
} from '../../../../src/domain/customers/repository';
import {
  ContractedService,
  ContractedServiceStatus,
  PaymentDay,
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
    startDate,
    paymentDay: PaymentDay.default()
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
  let serviceRepo: jest.Mocked<IContractedServiceRepository>;
  let planRepo: jest.Mocked<IServicePlanRepository>;
  let useCase: GenerateBillUseCase;
  let customerId: CustomerId;

  function serviceIs(service: ContractedService | null): void {
    (serviceRepo.findById as any).mockResolvedValue(
      Result.ok(service)
    );
  }

  function generate(
    service: ContractedService,
    extra: Record<string, unknown> = {}
  ) {
    return useCase.execute({
      contractedServiceId: service.id.toString(),
      year: 2024,
      month: 3,
      ...extra
    });
  }

  beforeEach(() => {
    billRepo = makeBillRepo();
    serviceRepo = makeServiceRepo();
    planRepo = makePlanRepo();
    useCase = new GenerateBillUseCase(
      billRepo,
      serviceRepo,
      planRepo,
      makeLogger()
    );
    customerId = CustomerId.parse(CUSTOMER_UUID).value;

    (billRepo.existsForServiceAndPeriod as any).mockResolvedValue(
      Result.ok(false)
    );
    (billRepo.save as any).mockImplementation(async (b: unknown) =>
      Result.ok(b)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("[BIL-007] bills one service: a single line snapshotting its plan, for the service's customer", async () => {
    const plan = makePlan({
      name: 'Fiber 100',
      monthlyPrice: 25000.75
    });
    const service = makeActiveService(customerId, plan.id);
    serviceIs(service);
    (planRepo.findById as any).mockResolvedValue(Result.ok(plan));

    const result = await generate(service);

    expect(result.isSuccess).toBe(true);
    const dto = result.value;
    expect(dto.customerId).toBe(CUSTOMER_UUID);
    expect(dto.lineItems).toHaveLength(1);
    expect(dto.lineItems[0]).toMatchObject({
      contractedServiceId: service.id.toString(),
      planName: 'Fiber 100',
      monthlyPrice: 25000.75
    });
    expect(dto.total).toBe(25000.75);
    expect(dto.status).toBe('PENDING');
    expect(billRepo.save).toHaveBeenCalledTimes(1);
    expect(serviceRepo.findByCustomerId).not.toHaveBeenCalled();
  });

  it('[BIL-291] a bill made by hand charges the whole month', async () => {
    const plan = makePlan({ monthlyPrice: 19990 });
    const service = makeActiveService(
      customerId,
      plan.id,
      new Date('2024-03-20T15:00:00.000Z')
    );
    serviceIs(service);
    (planRepo.findById as any).mockResolvedValue(Result.ok(plan));

    const result = await generate(service);

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
    let service: ContractedService;

    function startedOn(iso: string): ContractedService {
      service = makeActiveService(customerId, plan.id, new Date(iso));
      serviceIs(service);
      return service;
    }

    function run(proration: Record<string, string> = PRORATION) {
      return generate(service, { proration });
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

      const filters = billRepo.findAll.mock.calls[0][0]!;
      expect(filters.period!.toString()).toBe('2024-02');
      expect(filters.contractedServiceId!.equals(service.id)).toBe(
        true
      );
      expect(result.value.lineItems[0]).toMatchObject({
        amount: 19990 + 6893,
        serviceFrom: '2024-02-20',
        serviceTo: '2024-03-31'
      });
    });

    it("[BIL-289] does not charge last month's days again when last month's bill holds the service", async () => {
      startedOn('2024-02-20T15:00:00.000Z');
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
      startedOn('2024-02-20T15:00:00.000Z');
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

    it('[BIL-287] fails when the service starts after the month', async () => {
      startedOn('2024-04-02T15:00:00.000Z');

      const result = await run();

      expect(result.error).toBe(
        'Service has nothing to bill for period 2024-03'
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

  it('should fail when the service does not exist', async () => {
    const service = makeActiveService(customerId, makePlan().id);
    serviceIs(null);

    const result = await generate(service);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Contracted service not found');
    expect(billRepo.save).not.toHaveBeenCalled();
  });

  it('should fail for a malformed service id', async () => {
    const result = await useCase.execute({
      contractedServiceId: 'nope',
      year: 2024,
      month: 3
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid contractedServiceId');
  });

  it('[BIL-007] should fail when a non-cancelled bill already holds the service for the period', async () => {
    const service = makeActiveService(customerId, makePlan().id);
    serviceIs(service);
    (billRepo.existsForServiceAndPeriod as any).mockResolvedValue(
      Result.ok(true)
    );

    const result = await generate(service);

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      `A bill already exists for service ${service.id.toString()} for period 2024-03`
    );
    expect(
      billRepo.existsForServiceAndPeriod.mock.calls[0][0].equals(
        service.id
      )
    ).toBe(true);
    expect(billRepo.save).not.toHaveBeenCalled();
  });

  it('[BIL-081] should fail when the service is SUSPENDED', async () => {
    const service = makeActiveService(customerId, makePlan().id);
    service.suspend();
    serviceIs(service);

    const result = await generate(service);

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      'Contracted service is not active and cannot be billed'
    );
    expect(billRepo.save).not.toHaveBeenCalled();
  });

  it('should fail the whole generation when the service plan is missing', async () => {
    const service = makeActiveService(customerId, makePlan().id);
    serviceIs(service);
    (planRepo.findById as any).mockResolvedValue(Result.ok(null));

    const result = await generate(service);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Data integrity error');
    expect(result.error).toContain('does not exist');
    expect(billRepo.save).not.toHaveBeenCalled();
  });

  it('should propagate a repository save failure', async () => {
    const plan = makePlan();
    const service = makeActiveService(customerId, plan.id);
    serviceIs(service);
    (planRepo.findById as any).mockResolvedValue(Result.ok(plan));
    (billRepo.save as any).mockResolvedValue(
      Result.fail('DB write failed')
    );

    const result = await generate(service);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Failed to persist bill');
    expect(result.error).toContain('DB write failed');
  });
});
