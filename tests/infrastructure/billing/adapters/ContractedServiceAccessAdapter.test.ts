// Source: src/infrastructure/billing/adapters/ContractedServiceAccessAdapter.ts

import { ContractedServiceAccessAdapter } from '../../../../src/infrastructure/billing/adapters';
import {
  ContractedService,
  ContractedServiceStatus
} from '../../../../src/domain/customers';
import { IContractedServiceRepository } from '../../../../src/domain/customers/repository';
import {
  CustomerId,
  DeviceId,
  ServicePlanId
} from '../../../../src/domain/shared/ids';
import { Result } from '../../../../src/domain/shared/core/Result';

const CUSTOMER = '11111111-1111-4111-8111-111111111111';

function service(
  status: ContractedServiceStatus,
  withDevice = true
): ContractedService {
  return ContractedService.create({
    customerId: CustomerId.parse(CUSTOMER).value,
    servicePlanId: ServicePlanId.create(),
    deviceId: withDevice ? DeviceId.create() : null,
    status,
    startDate: new Date('2026-01-10T15:00:00Z')
  }).value;
}

describe('ContractedServiceAccessAdapter', () => {
  let repo: { findByCustomerId: jest.Mock; save: jest.Mock };
  let adapter: ContractedServiceAccessAdapter;

  beforeEach(() => {
    repo = {
      findByCustomerId: jest.fn(),
      save: jest.fn(async (s: ContractedService) => Result.ok(s))
    };
    adapter = new ContractedServiceAccessAdapter(
      repo as unknown as IContractedServiceRepository
    );
  });

  it('[BIL-310] suspends only the active services', async () => {
    const active = service(ContractedServiceStatus.ACTIVE);
    const pending = service(ContractedServiceStatus.PENDING, false);
    repo.findByCustomerId.mockResolvedValue(
      Result.ok([active, pending])
    );

    const result = await adapter.suspendActiveServices(CUSTOMER);

    expect(result.value).toEqual({ changed: 1, failed: [] });
    expect(active.status).toBe(ContractedServiceStatus.SUSPENDED);
    expect(pending.status).toBe(ContractedServiceStatus.PENDING);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('[BIL-311] restores every suspended service and reports one it cannot', async () => {
    const back = service(ContractedServiceStatus.SUSPENDED);
    const noDevice = service(
      ContractedServiceStatus.SUSPENDED,
      false
    );
    repo.findByCustomerId.mockResolvedValue(
      Result.ok([back, noDevice])
    );

    const result = await adapter.restoreSuspendedServices(CUSTOMER);

    expect(back.status).toBe(ContractedServiceStatus.ACTIVE);
    expect(result.value.changed).toBe(1);
    expect(result.value.failed).toEqual([
      {
        id: noDevice.id.toString(),
        error:
          'Cannot activate a contracted service without a device assigned'
      }
    ]);
  });

  it('reports a service that could not be saved', async () => {
    const active = service(ContractedServiceStatus.ACTIVE);
    repo.findByCustomerId.mockResolvedValue(Result.ok([active]));
    repo.save.mockResolvedValue(Result.fail('DB down'));

    const result = await adapter.suspendActiveServices(CUSTOMER);

    expect(result.value).toEqual({
      changed: 0,
      failed: [{ id: active.id.toString(), error: 'DB down' }]
    });
  });

  it('fails when the services cannot be read', async () => {
    repo.findByCustomerId.mockResolvedValue(Result.fail('DB down'));

    expect(
      (await adapter.suspendActiveServices(CUSTOMER)).error
    ).toBe('DB down');
  });

  it('fails for a malformed customer id', async () => {
    expect(
      (await adapter.restoreSuspendedServices('nope')).error
    ).toContain('Invalid customerId');
  });
});
