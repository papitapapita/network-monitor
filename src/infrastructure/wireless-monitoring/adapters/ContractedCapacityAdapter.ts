import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  ContractedService,
  ContractedServiceStatus,
  IContractedServiceRepository,
  IServicePlanRepository,
  ServicePlan
} from 'domain/customers';
import { IContractedCapacityProvider } from 'application/wireless-monitoring/interfaces';

// A suspended link is throttled by enforcement and a cancelled one is no
// longer sold, so neither has a plan capacity worth measuring against.
const CAPACITY_BEARING_STATUSES: ReadonlySet<ContractedServiceStatus> =
  new Set([
    ContractedServiceStatus.ACTIVE,
    ContractedServiceStatus.PENDING
  ]);

export class ContractedCapacityAdapter
  implements IContractedCapacityProvider
{
  constructor(
    private readonly contractedServiceRepo: IContractedServiceRepository,
    private readonly servicePlanRepo: IServicePlanRepository
  ) {}

  async findKbpsByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<number | null>> {
    const serviceResult =
      await this.contractedServiceRepo.findByDeviceId(deviceId);
    if (serviceResult.isFailure)
      return Result.fail(serviceResult.error!);

    const service = serviceResult.value;
    if (!service || !CAPACITY_BEARING_STATUSES.has(service.status)) {
      return Result.ok(null);
    }

    const planResult = await this.servicePlanRepo.findById(
      service.servicePlanId
    );
    if (planResult.isFailure) return Result.fail(planResult.error!);
    if (!planResult.value) return Result.ok(null);

    return Result.ok(this.toKbps(planResult.value));
  }

  async findKbpsForAllDevices(): Promise<
    Result<Map<string, number>>
  > {
    const services: ContractedService[] = [];
    for (const status of CAPACITY_BEARING_STATUSES) {
      const result =
        await this.contractedServiceRepo.findByStatus(status);
      if (result.isFailure) return Result.fail(result.error!);
      services.push(...result.value);
    }

    const plansResult = await this.servicePlanRepo.findAll();
    if (plansResult.isFailure) return Result.fail(plansResult.error!);
    const plansById = new Map(
      plansResult.value.map((p) => [p.id.toString(), p])
    );

    const byDevice = new Map<string, number>();
    for (const service of services) {
      if (!service.deviceId) continue;
      const plan = plansById.get(service.servicePlanId.toString());
      if (!plan) continue;
      byDevice.set(service.deviceId.toString(), this.toKbps(plan));
    }
    return Result.ok(byDevice);
  }

  private toKbps(plan: ServicePlan): number {
    return (plan.downloadMbps + plan.uploadMbps) * 1000;
  }
}
