import { Result } from 'domain/shared/core';
import { CustomerId } from 'domain/shared/ids';
import {
  ContractedService,
  ContractedServiceStatus
} from 'domain/customers';
import { IContractedServiceRepository } from 'domain/customers/repository';
import {
  ICustomerServiceAccess,
  ServiceAccessOutcome
} from 'application/billing/interfaces';

export class ContractedServiceAccessAdapter
  implements ICustomerServiceAccess
{
  constructor(
    private readonly contractedServiceRepository: IContractedServiceRepository
  ) {}

  suspendActiveServices(
    customerId: string
  ): Promise<Result<ServiceAccessOutcome>> {
    return this.transition(
      customerId,
      ContractedServiceStatus.ACTIVE,
      (service) => service.suspend()
    );
  }

  restoreSuspendedServices(
    customerId: string
  ): Promise<Result<ServiceAccessOutcome>> {
    return this.transition(
      customerId,
      ContractedServiceStatus.SUSPENDED,
      (service) => service.reactivate()
    );
  }

  private async transition(
    customerId: string,
    from: ContractedServiceStatus,
    change: (service: ContractedService) => Result<void>
  ): Promise<Result<ServiceAccessOutcome>> {
    const id = CustomerId.parse(customerId);
    if (id.isFailure) {
      return Result.fail(`Invalid customerId: ${id.error}`);
    }

    const services =
      await this.contractedServiceRepository.findByCustomerId(
        id.value
      );
    if (services.isFailure) return Result.fail(services.error!);

    const outcome: ServiceAccessOutcome = { changed: 0, failed: [] };
    for (const service of services.value) {
      if (service.status !== from) continue;
      const serviceId = service.id.toString();

      const changed = change(service);
      if (changed.isFailure) {
        outcome.failed.push({ id: serviceId, error: changed.error! });
        continue;
      }
      const saved =
        await this.contractedServiceRepository.save(service);
      if (saved.isFailure) {
        outcome.failed.push({ id: serviceId, error: saved.error! });
        continue;
      }
      outcome.changed++;
    }
    return Result.ok(outcome);
  }
}
