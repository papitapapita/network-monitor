// Source: src/application/billing/use-cases/RestoreServicesAfterPaymentUseCase.ts

import { RestoreServicesAfterPaymentUseCase } from '../../../../src/application/billing/use-cases/RestoreServicesAfterPaymentUseCase';
import { ICustomerServiceAccess } from '../../../../src/application/billing/interfaces';
import {
  IBillRepository,
  IBillingSettingsRepository
} from '../../../../src/domain/billing/repository';
import {
  BillingMode,
  BillingSettings,
  BillStatus
} from '../../../../src/domain/billing';
import { Result } from '../../../../src/domain/shared/core/Result';
import { makeLogger } from '../../probe-agents/fixtures';

const CUSTOMER = '11111111-1111-4111-8111-111111111111';

function settings(automaticCutEnabled: boolean): BillingSettings {
  return BillingSettings.reconstitute({
    automaticBillingEnabled: true,
    billingMode: BillingMode.ADVANCE,
    issueLeadDays: 5,
    graceDays: 3,
    automaticCutEnabled
  });
}

describe('RestoreServicesAfterPaymentUseCase', () => {
  let settingsRepo: jest.Mocked<IBillingSettingsRepository>;
  let billRepo: { count: jest.Mock };
  let serviceAccess: jest.Mocked<ICustomerServiceAccess>;
  let useCase: RestoreServicesAfterPaymentUseCase;

  beforeEach(() => {
    settingsRepo = {
      get: jest.fn().mockResolvedValue(Result.ok(settings(true))),
      save: jest.fn()
    };
    billRepo = { count: jest.fn().mockResolvedValue(Result.ok(0)) };
    serviceAccess = {
      suspendActiveServices: jest.fn(),
      restoreSuspendedServices: jest
        .fn()
        .mockResolvedValue(Result.ok({ changed: 2, failed: [] }))
    };
    useCase = new RestoreServicesAfterPaymentUseCase(
      settingsRepo,
      billRepo as unknown as IBillRepository,
      serviceAccess,
      makeLogger()
    );
  });

  it('[BIL-311] restores the services once no bill is overdue', async () => {
    const result = await useCase.execute({ customerId: CUSTOMER });

    expect(billRepo.count.mock.calls[0][0].status).toBe(
      BillStatus.OVERDUE
    );
    expect(
      billRepo.count.mock.calls[0][0].customerId.toString()
    ).toBe(CUSTOMER);
    expect(
      serviceAccess.restoreSuspendedServices
    ).toHaveBeenCalledWith(CUSTOMER);
    expect(result.value).toEqual({
      attempted: true,
      restored: 2,
      failed: []
    });
  });

  it('[BIL-311] waits while a bill is still overdue', async () => {
    billRepo.count.mockResolvedValue(Result.ok(1));

    const result = await useCase.execute({ customerId: CUSTOMER });

    expect(result.value.attempted).toBe(false);
    expect(
      serviceAccess.restoreSuspendedServices
    ).not.toHaveBeenCalled();
  });

  it('[BIL-311] does nothing while the automatic cut is off', async () => {
    settingsRepo.get.mockResolvedValue(Result.ok(settings(false)));

    const result = await useCase.execute({ customerId: CUSTOMER });

    expect(result.value.attempted).toBe(false);
    expect(billRepo.count).not.toHaveBeenCalled();
  });

  it('fails when the settings cannot be read', async () => {
    settingsRepo.get.mockResolvedValue(Result.fail('DB down'));

    const result = await useCase.execute({ customerId: CUSTOMER });

    expect(result.error).toBe(
      'Failed to load billing settings: DB down'
    );
  });

  it('fails for a malformed customer id', async () => {
    const result = await useCase.execute({ customerId: 'nope' });

    expect(result.error).toContain('Invalid customerId');
  });
});
