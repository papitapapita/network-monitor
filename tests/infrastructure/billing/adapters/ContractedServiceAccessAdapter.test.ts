// Source: src/infrastructure/billing/adapters/ContractedServiceAccessAdapter.ts

import { ContractedServiceAccessAdapter } from '../../../../src/infrastructure/billing/adapters';
import {
  ContractedService,
  ContractedServiceStatus,
  PaymentDay
} from '../../../../src/domain/customers';
import { IContractedServiceRepository } from '../../../../src/domain/customers/repository';
import {
  CustomerId,
  DeviceId,
  ServicePlanId
} from '../../../../src/domain/shared/ids';
import { Result } from '../../../../src/domain/shared/core/Result';

function service(
  status: ContractedServiceStatus,
  withDevice = true
): ContractedService {
  return ContractedService.create({
    customerId: CustomerId.create(),
    servicePlanId: ServicePlanId.create(),
    deviceId: withDevice ? DeviceId.create() : null,
    status,
    startDate: new Date('2026-01-10T15:00:00Z'),
    paymentDay: PaymentDay.default()
  }).value;
}

describe('ContractedServiceAccessAdapter', () => {
  let repo: { findById: jest.Mock; save: jest.Mock };
  let adapter: ContractedServiceAccessAdapter;

  function found(s: ContractedService | null): void {
    repo.findById.mockResolvedValue(Result.ok(s));
  }

  beforeEach(() => {
    repo = {
      findById: jest.fn(),
      save: jest.fn(async (s: ContractedService) => Result.ok(s))
    };
    adapter = new ContractedServiceAccessAdapter(
      repo as unknown as IContractedServiceRepository
    );
  });

  it('[BIL-310] suspends an active service', async () => {
    const active = service(ContractedServiceStatus.ACTIVE);
    found(active);

    const result = await adapter.suspendService(active.id.toString());

    expect(result.value).toBe(true);
    expect(active.status).toBe(ContractedServiceStatus.SUSPENDED);
    expect(repo.findById.mock.calls[0][0].equals(active.id)).toBe(
      true
    );
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('[BIL-310] leaves a service that is not active alone', async () => {
    const pending = service(ContractedServiceStatus.PENDING, false);
    found(pending);

    const result = await adapter.suspendService(
      pending.id.toString()
    );

    expect(result.value).toBe(false);
    expect(pending.status).toBe(ContractedServiceStatus.PENDING);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('[BIL-311] restores a suspended service', async () => {
    const back = service(ContractedServiceStatus.SUSPENDED);
    found(back);

    const result = await adapter.restoreService(back.id.toString());

    expect(result.value).toBe(true);
    expect(back.status).toBe(ContractedServiceStatus.ACTIVE);
  });

  it('[BIL-311] leaves a cancelled service alone', async () => {
    const cancelled = service(ContractedServiceStatus.ACTIVE);
    cancelled.cancel();
    found(cancelled);

    const result = await adapter.restoreService(
      cancelled.id.toString()
    );

    expect(result.value).toBe(false);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('fails when the suspended service has no device to come back on', async () => {
    const noDevice = service(
      ContractedServiceStatus.SUSPENDED,
      false
    );
    found(noDevice);

    const result = await adapter.restoreService(
      noDevice.id.toString()
    );

    expect(result.error).toBe(
      'Cannot activate a contracted service without a device assigned'
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('reports false for a service that no longer exists', async () => {
    const gone = service(ContractedServiceStatus.ACTIVE);
    found(null);

    const result = await adapter.suspendService(gone.id.toString());

    expect(result.value).toBe(false);
  });

  it('fails when the service could not be saved', async () => {
    const active = service(ContractedServiceStatus.ACTIVE);
    found(active);
    repo.save.mockResolvedValue(Result.fail('DB down'));

    const result = await adapter.suspendService(active.id.toString());

    expect(result.error).toBe('DB down');
  });

  it('fails when the service cannot be read', async () => {
    repo.findById.mockResolvedValue(Result.fail('DB down'));

    expect(
      (
        await adapter.suspendService(
          service(ContractedServiceStatus.ACTIVE).id.toString()
        )
      ).error
    ).toBe('DB down');
  });

  it('fails for a malformed service id', async () => {
    expect((await adapter.restoreService('nope')).error).toContain(
      'Invalid contractedServiceId'
    );
  });
});
