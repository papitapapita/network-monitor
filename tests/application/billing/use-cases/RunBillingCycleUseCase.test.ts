// Source: src/application/billing/use-cases/RunBillingCycleUseCase.ts

import { RunBillingCycleUseCase } from '../../../../src/application/billing/use-cases/RunBillingCycleUseCase';
import { GenerateBillUseCase } from '../../../../src/application/billing/use-cases/GenerateBillUseCase';
import { IBillableCustomersQuery } from '../../../../src/application/billing/interfaces';
import {
  IBillRepository,
  IBillingSettingsRepository
} from '../../../../src/domain/billing/repository';
import {
  Bill,
  BillStatus,
  BillingMode,
  BillingPeriod,
  BillingSettings,
  BillLineItem
} from '../../../../src/domain/billing';
import {
  BillId,
  CustomerId,
  ContractedServiceId,
  ServicePlanId
} from '../../../../src/domain/shared/ids';
import { Money } from '../../../../src/domain/shared/value-objects';
import { Result } from '../../../../src/domain/shared/core/Result';
import { makeLogger } from '../../probe-agents/fixtures';

// 06:00 on 12 Oct in Bogotá: the 15th group's window is open, the 30th's not.
const NOW = new Date('2026-10-12T11:00:00.000Z');
const CUSTOMER_15 = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_30 = '33333333-3333-4333-8333-333333333333';
const STARTED = '2026-01-10T15:00:00.000Z';

function enabled(
  billingMode: BillingMode = BillingMode.ADVANCE
): BillingSettings {
  return BillingSettings.reconstitute({
    automaticBillingEnabled: true,
    billingMode,
    issueLeadDays: 5,
    graceDays: 3
  });
}

function makePendingBill(dueDate: Date): Bill {
  return Bill.reconstitute(BillId.create(), {
    customerId: CustomerId.create(),
    period: BillingPeriod.create(2026, 9).value,
    status: BillStatus.PENDING,
    lineItems: [
      BillLineItem.create({
        contractedServiceId: ContractedServiceId.create(),
        servicePlanId: ServicePlanId.create(),
        planName: 'Fibra 50',
        monthlyPrice: Money.create(80000).value
      }).value
    ],
    issueDate: new Date('2026-09-25T11:00:00.000Z'),
    dueDate,
    paidAt: null,
    createdAt: new Date('2026-09-25T11:00:00.000Z'),
    updatedAt: new Date('2026-09-25T11:00:00.000Z')
  });
}

describe('RunBillingCycleUseCase', () => {
  let settingsRepo: jest.Mocked<IBillingSettingsRepository>;
  let query: jest.Mocked<IBillableCustomersQuery>;
  let billRepo: jest.Mocked<IBillRepository>;
  let generate: { execute: jest.Mock };
  let useCase: RunBillingCycleUseCase;

  beforeEach(() => {
    settingsRepo = {
      get: jest.fn().mockResolvedValue(Result.ok(enabled())),
      save: jest.fn()
    };
    query = {
      listBillable: jest.fn().mockResolvedValue(
        Result.ok([
          {
            customerId: CUSTOMER_15,
            paymentDay: 15,
            firstServiceStart: STARTED
          },
          {
            customerId: CUSTOMER_30,
            paymentDay: 30,
            firstServiceStart: STARTED
          }
        ])
      )
    };
    billRepo = {
      save: jest.fn(async (bill: Bill) => Result.ok(bill)),
      findById: jest.fn(),
      findByCustomerId: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn().mockResolvedValue(Result.ok(0)),
      existsForCustomerAndPeriod: jest.fn(),
      exists: jest.fn(),
      findPendingDueBefore: jest.fn().mockResolvedValue(Result.ok([]))
    };
    generate = {
      execute: jest.fn().mockResolvedValue(Result.ok({}))
    };
    useCase = new RunBillingCycleUseCase(
      settingsRepo,
      query,
      billRepo,
      generate as unknown as GenerateBillUseCase,
      makeLogger()
    );
  });

  it('[BIL-284] does nothing while automatic billing is off', async () => {
    settingsRepo.get.mockResolvedValue(
      Result.ok(BillingSettings.defaults())
    );

    const result = await useCase.execute({ now: NOW });

    expect(result.value).toEqual({
      automaticBillingEnabled: false,
      generated: 0,
      markedOverdue: 0,
      failed: []
    });
    expect(billRepo.findPendingDueBefore).not.toHaveBeenCalled();
    expect(query.listBillable).not.toHaveBeenCalled();
  });

  it('fails when the settings cannot be read', async () => {
    settingsRepo.get.mockResolvedValue(Result.fail('DB down'));

    const result = await useCase.execute({ now: NOW });

    expect(result.error).toBe(
      'Failed to load billing settings: DB down'
    );
  });

  it('[BIL-283] issues the bill of a customer whose window is open, and only theirs', async () => {
    const result = await useCase.execute({ now: NOW });

    expect(generate.execute).toHaveBeenCalledTimes(1);
    expect(generate.execute).toHaveBeenCalledWith({
      customerId: CUSTOMER_15,
      year: 2026,
      month: 10,
      issueDate: NOW.toISOString(),
      dueDate: '2026-10-16T04:59:59.999Z',
      proration: {
        billingMode: 'ADVANCE',
        previousIssueDay: '2026-09-10'
      }
    });
    expect(result.value.generated).toBe(1);
  });

  it('[BIL-287] paid after use, a customer whose services all start after the billed month waits', async () => {
    settingsRepo.get.mockResolvedValue(
      Result.ok(enabled(BillingMode.ARREARS))
    );
    query.listBillable.mockResolvedValue(
      Result.ok([
        {
          customerId: CUSTOMER_15,
          paymentDay: 15,
          firstServiceStart: '2026-10-01T05:00:00.000Z'
        }
      ])
    );

    const result = await useCase.execute({ now: NOW });

    expect(generate.execute).not.toHaveBeenCalled();
    expect(result.value.failed).toEqual([]);
  });

  it("[BIL-287] a service starting on the billed month's last local day is billed", async () => {
    settingsRepo.get.mockResolvedValue(
      Result.ok(enabled(BillingMode.ARREARS))
    );
    query.listBillable.mockResolvedValue(
      Result.ok([
        {
          customerId: CUSTOMER_15,
          paymentDay: 15,
          // 30 Sep, 23:00 in Bogotá
          firstServiceStart: '2026-10-01T04:00:00.000Z'
        }
      ])
    );

    await useCase.execute({ now: NOW });

    expect(generate.execute).toHaveBeenCalledTimes(1);
  });

  it('[BIL-282] paid after use, the bill covers the month before', async () => {
    settingsRepo.get.mockResolvedValue(
      Result.ok(enabled(BillingMode.ARREARS))
    );

    await useCase.execute({ now: NOW });

    expect(generate.execute.mock.calls[0][0]).toMatchObject({
      year: 2026,
      month: 9
    });
  });

  it('[BIL-284] never bills a period that already has a bill, even a cancelled one', async () => {
    billRepo.count.mockResolvedValue(Result.ok(1));

    const result = await useCase.execute({ now: NOW });

    expect(billRepo.count.mock.calls[0][0]!.period!.toString()).toBe(
      '2026-10'
    );
    expect(generate.execute).not.toHaveBeenCalled();
    expect(result.value.generated).toBe(0);
    expect(result.value.failed).toEqual([]);
  });

  it('[BIL-284] records a customer that could not be billed and goes on', async () => {
    query.listBillable.mockResolvedValue(
      Result.ok([
        {
          customerId: CUSTOMER_15,
          paymentDay: 15,
          firstServiceStart: STARTED
        },
        {
          customerId: '22222222-2222-4222-8222-222222222222',
          paymentDay: 15,
          firstServiceStart: STARTED
        }
      ])
    );
    generate.execute
      .mockResolvedValueOnce(Result.fail('plan missing'))
      .mockResolvedValueOnce(Result.ok({}));

    const result = await useCase.execute({ now: NOW });

    expect(result.value.generated).toBe(1);
    expect(result.value.failed).toEqual([
      { id: CUSTOMER_15, error: 'plan missing' }
    ]);
  });

  it('fails the run when the customers cannot be listed', async () => {
    query.listBillable.mockResolvedValue(Result.fail('DB down'));

    const result = await useCase.execute({ now: NOW });

    expect(result.error).toBe('DB down');
  });

  it('[BIL-286] marks every unpaid bill past its due date overdue', async () => {
    const pastDue = makePendingBill(
      new Date('2026-10-01T04:59:59.999Z')
    );
    billRepo.findPendingDueBefore.mockResolvedValue(
      Result.ok([pastDue])
    );

    const result = await useCase.execute({ now: NOW });

    expect(billRepo.findPendingDueBefore).toHaveBeenCalledWith(NOW);
    expect(pastDue.status).toBe(BillStatus.OVERDUE);
    expect(billRepo.save).toHaveBeenCalledWith(pastDue);
    expect(result.value.markedOverdue).toBe(1);
  });

  it('[BIL-286] records a bill that could not be saved and goes on', async () => {
    const first = makePendingBill(
      new Date('2026-10-01T04:59:59.999Z')
    );
    const second = makePendingBill(
      new Date('2026-10-01T04:59:59.999Z')
    );
    billRepo.findPendingDueBefore.mockResolvedValue(
      Result.ok([first, second])
    );
    billRepo.save.mockResolvedValueOnce(Result.fail('DB down'));

    const result = await useCase.execute({ now: NOW });

    expect(result.value.markedOverdue).toBe(1);
    expect(result.value.failed).toEqual([
      { id: first.id.toString(), error: 'DB down' }
    ]);
  });
});
