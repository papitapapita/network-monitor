// Source: src/application/billing/use-cases/RestoreServicesAfterPaymentUseCase.ts

import { RestoreServicesAfterPaymentUseCase } from '../../../../src/application/billing/use-cases/RestoreServicesAfterPaymentUseCase';
import { ICustomerServiceAccess } from '../../../../src/application/billing/interfaces';
import {
  IBillRepository,
  IBillingSettingsRepository
} from '../../../../src/domain/billing/repository';
import {
  Bill,
  BillingMode,
  BillingPeriod,
  BillingSettings,
  BillLineItem,
  BillStatus
} from '../../../../src/domain/billing';
import {
  BillId,
  ContractedServiceId,
  CustomerId,
  ServicePlanId
} from '../../../../src/domain/shared/ids';
import { Money } from '../../../../src/domain/shared/value-objects';
import { Result } from '../../../../src/domain/shared/core/Result';
import { makeLogger } from '../../probe-agents/fixtures';

const NOW = new Date('2026-10-20T12:00:00.000Z');

function settings(automaticCutEnabled: boolean): BillingSettings {
  return BillingSettings.reconstitute({
    automaticBillingEnabled: true,
    billingMode: BillingMode.ADVANCE,
    issueLeadDays: 5,
    graceDays: 3,
    automaticCutEnabled,
    reminderWhatsAppTemplate: null,
    billWhatsAppTemplate: null
  });
}

function makePaidBill(...services: ContractedServiceId[]): Bill {
  return Bill.reconstitute(BillId.create(), {
    customerId: CustomerId.create(),
    period: BillingPeriod.create(2026, 10).value,
    status: BillStatus.PAID,
    lineItems: services.map(
      (contractedServiceId) =>
        BillLineItem.create({
          contractedServiceId,
          servicePlanId: ServicePlanId.create(),
          planName: 'Fiber 50/10',
          monthlyPrice: Money.create(80000).value
        }).value
    ),
    issueDate: NOW,
    dueDate: NOW,
    paidAt: NOW,
    createdAt: NOW,
    updatedAt: NOW
  });
}

describe('RestoreServicesAfterPaymentUseCase', () => {
  let settingsRepo: jest.Mocked<IBillingSettingsRepository>;
  let billRepo: { count: jest.Mock; findById: jest.Mock };
  let serviceAccess: jest.Mocked<ICustomerServiceAccess>;
  let useCase: RestoreServicesAfterPaymentUseCase;
  let service: ContractedServiceId;
  let bill: Bill;

  function run() {
    return useCase.execute({ billId: bill.id.toString() });
  }

  beforeEach(() => {
    service = ContractedServiceId.create();
    bill = makePaidBill(service);
    settingsRepo = {
      get: jest.fn().mockResolvedValue(Result.ok(settings(true))),
      save: jest.fn()
    };
    billRepo = {
      count: jest.fn().mockResolvedValue(Result.ok(0)),
      findById: jest.fn().mockResolvedValue(Result.ok(bill))
    };
    serviceAccess = {
      suspendService: jest.fn(),
      restoreService: jest.fn().mockResolvedValue(Result.ok(true))
    };
    useCase = new RestoreServicesAfterPaymentUseCase(
      settingsRepo,
      billRepo as unknown as IBillRepository,
      serviceAccess,
      makeLogger()
    );
  });

  it("[BIL-311] restores the paid bill's service once none of its bills is overdue", async () => {
    const result = await run();

    const filters = billRepo.count.mock.calls[0][0];
    expect(filters.status).toBe(BillStatus.OVERDUE);
    expect(filters.contractedServiceId.equals(service)).toBe(true);
    expect(filters.customerId).toBeUndefined();
    expect(serviceAccess.restoreService).toHaveBeenCalledWith(
      service.toString()
    );
    expect(result.value).toEqual({
      attempted: true,
      restored: 1,
      failed: []
    });
  });

  it('[BIL-311] leaves a service alone while another of its bills is overdue', async () => {
    billRepo.count.mockResolvedValue(Result.ok(1));

    const result = await run();

    expect(result.value).toEqual({
      attempted: true,
      restored: 0,
      failed: []
    });
    expect(serviceAccess.restoreService).not.toHaveBeenCalled();
  });

  it('[BIL-311] judges each service on the bill by its own overdue bills', async () => {
    const other = ContractedServiceId.create();
    bill = makePaidBill(service, other);
    billRepo.findById.mockResolvedValue(Result.ok(bill));
    billRepo.count.mockImplementation(async (filters) =>
      Result.ok(filters.contractedServiceId.equals(other) ? 1 : 0)
    );

    const result = await run();

    expect(serviceAccess.restoreService).toHaveBeenCalledTimes(1);
    expect(serviceAccess.restoreService).toHaveBeenCalledWith(
      service.toString()
    );
    expect(result.value.restored).toBe(1);
  });

  it('does not count a service that was not suspended', async () => {
    serviceAccess.restoreService.mockResolvedValue(Result.ok(false));

    const result = await run();

    expect(result.value.restored).toBe(0);
  });

  it('reports a service that could not be restored and keeps going', async () => {
    const other = ContractedServiceId.create();
    bill = makePaidBill(service, other);
    billRepo.findById.mockResolvedValue(Result.ok(bill));
    serviceAccess.restoreService
      .mockResolvedValueOnce(Result.fail('DB down'))
      .mockResolvedValueOnce(Result.ok(true));

    const result = await run();

    expect(result.value).toEqual({
      attempted: true,
      restored: 1,
      failed: [{ id: service.toString(), error: 'DB down' }]
    });
  });

  it('[BIL-311] does nothing while the automatic cut is off', async () => {
    settingsRepo.get.mockResolvedValue(Result.ok(settings(false)));

    const result = await run();

    expect(result.value.attempted).toBe(false);
    expect(billRepo.findById).not.toHaveBeenCalled();
    expect(billRepo.count).not.toHaveBeenCalled();
  });

  it('fails when the settings cannot be read', async () => {
    settingsRepo.get.mockResolvedValue(Result.fail('DB down'));

    const result = await run();

    expect(result.error).toBe(
      'Failed to load billing settings: DB down'
    );
  });

  it('fails when the bill does not exist', async () => {
    billRepo.findById.mockResolvedValue(Result.ok(null));

    const result = await run();

    expect(result.error).toBe(
      `Bill not found: ${bill.id.toString()}`
    );
  });

  it('fails for a malformed bill id', async () => {
    const result = await useCase.execute({ billId: 'nope' });

    expect(result.error).toContain('Invalid billId');
  });
});
