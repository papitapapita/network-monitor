// Source: src/infrastructure/wireless-monitoring/adapters/ContractedCapacityAdapter.ts

import { ContractedCapacityAdapter } from '../../../../src/infrastructure/wireless-monitoring/adapters/ContractedCapacityAdapter';
import {
  ContractedService,
  ContractedServiceStatus,
  IContractedServiceRepository,
  IServicePlanRepository,
  ServicePlan
} from '../../../../src/domain/customers';
import {
  ContractedServiceId,
  CustomerId,
  DeviceId,
  ServicePlanId
} from '../../../../src/domain/shared/ids';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePlan(downloadMbps = 15, uploadMbps = 5): ServicePlan {
  return ServicePlan.reconstitute(ServicePlanId.create(), {
    name: `Plan ${downloadMbps}/${uploadMbps}`,
    downloadMbps,
    uploadMbps,
    monthlyPrice: 80000,
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

function makeService(
  plan: ServicePlan,
  deviceId: DeviceId | null,
  status = ContractedServiceStatus.ACTIVE
): ContractedService {
  return ContractedService.reconstitute(
    ContractedServiceId.create(),
    {
      customerId: CustomerId.create(),
      servicePlanId: plan.id,
      deviceId,
      status,
      startDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }
  );
}

function makeRepos() {
  const contractedServiceRepo = {
    findByDeviceId: jest.fn(),
    findByStatus: jest.fn()
  } as unknown as jest.Mocked<IContractedServiceRepository>;
  const servicePlanRepo = {
    findById: jest.fn(),
    findAll: jest.fn()
  } as unknown as jest.Mocked<IServicePlanRepository>;
  return { contractedServiceRepo, servicePlanRepo };
}

// ---------------------------------------------------------------------------

describe('[WLS-166] ContractedCapacityAdapter', () => {
  let repos: ReturnType<typeof makeRepos>;
  let adapter: ContractedCapacityAdapter;
  const deviceId = DeviceId.create();

  beforeEach(() => {
    repos = makeRepos();
    adapter = new ContractedCapacityAdapter(
      repos.contractedServiceRepo,
      repos.servicePlanRepo
    );
  });

  describe('findKbpsByDeviceId()', () => {
    it('returns download + upload in kbps for an active service', async () => {
      const plan = makePlan(15, 5);
      repos.contractedServiceRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeService(plan, deviceId))
      );
      repos.servicePlanRepo.findById.mockResolvedValue(
        Result.ok(plan)
      );

      const result = await adapter.findKbpsByDeviceId(deviceId);

      expect(result.value).toBe(20_000);
    });

    it('counts a pending service — installation precedes activation', async () => {
      const plan = makePlan();
      repos.contractedServiceRepo.findByDeviceId.mockResolvedValue(
        Result.ok(
          makeService(plan, deviceId, ContractedServiceStatus.PENDING)
        )
      );
      repos.servicePlanRepo.findById.mockResolvedValue(
        Result.ok(plan)
      );

      const result = await adapter.findKbpsByDeviceId(deviceId);

      expect(result.value).toBe(20_000);
    });

    it.each([
      ContractedServiceStatus.SUSPENDED,
      ContractedServiceStatus.CANCELLED
    ])('returns null for a %s service', async (status) => {
      repos.contractedServiceRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeService(makePlan(), deviceId, status))
      );

      const result = await adapter.findKbpsByDeviceId(deviceId);

      expect(result.value).toBeNull();
      expect(repos.servicePlanRepo.findById).not.toHaveBeenCalled();
    });

    it('returns null when no service covers the device', async () => {
      repos.contractedServiceRepo.findByDeviceId.mockResolvedValue(
        Result.ok(null)
      );

      const result = await adapter.findKbpsByDeviceId(deviceId);

      expect(result.value).toBeNull();
    });

    it('propagates a repository failure', async () => {
      repos.contractedServiceRepo.findByDeviceId.mockResolvedValue(
        Result.fail('connection reset')
      );

      const result = await adapter.findKbpsByDeviceId(deviceId);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('connection reset');
    });
  });

  describe('findKbpsForAllDevices()', () => {
    it('keys each active or pending service to its device', async () => {
      const small = makePlan(8, 2);
      const large = makePlan(40, 10);
      const pendingDevice = DeviceId.create();
      repos.contractedServiceRepo.findByStatus.mockImplementation(
        async (status) =>
          Result.ok(
            status === ContractedServiceStatus.ACTIVE
              ? [makeService(small, deviceId)]
              : [
                  makeService(
                    large,
                    pendingDevice,
                    ContractedServiceStatus.PENDING
                  )
                ]
          )
      );
      repos.servicePlanRepo.findAll.mockResolvedValue(
        Result.ok([small, large])
      );

      const result = await adapter.findKbpsForAllDevices();

      expect(result.value).toEqual(
        new Map([
          [deviceId.toString(), 10_000],
          [pendingDevice.toString(), 50_000]
        ])
      );
      expect(
        repos.contractedServiceRepo.findByStatus
      ).not.toHaveBeenCalledWith(ContractedServiceStatus.SUSPENDED);
    });

    it('skips services with no device assigned', async () => {
      const plan = makePlan();
      repos.contractedServiceRepo.findByStatus.mockImplementation(
        async (status) =>
          Result.ok(
            status === ContractedServiceStatus.ACTIVE
              ? [makeService(plan, null)]
              : []
          )
      );
      repos.servicePlanRepo.findAll.mockResolvedValue(
        Result.ok([plan])
      );

      const result = await adapter.findKbpsForAllDevices();

      expect(result.value.size).toBe(0);
    });

    it('propagates a plan lookup failure', async () => {
      repos.contractedServiceRepo.findByStatus.mockResolvedValue(
        Result.ok([])
      );
      repos.servicePlanRepo.findAll.mockResolvedValue(
        Result.fail('connection reset')
      );

      const result = await adapter.findKbpsForAllDevices();

      expect(result.isFailure).toBe(true);
    });
  });
});
