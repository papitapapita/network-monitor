import { Result } from 'domain/shared/core';
import { ContractedServiceId } from 'domain/shared/ids';
import {
  ContractedService,
  ContractedServiceStatus
} from 'domain/customers';
import { IContractedServiceRepository } from 'domain/customers/repository';
import { ICustomerServiceAccess } from 'application/billing/interfaces';

export class ContractedServiceAccessAdapter
  implements ICustomerServiceAccess
{
  constructor(
    private readonly contractedServiceRepository: IContractedServiceRepository
  ) {}

  suspendService(
    contractedServiceId: string
  ): Promise<Result<boolean>> {
    return this.transition(
      contractedServiceId,
      ContractedServiceStatus.ACTIVE,
      (service) => service.suspend()
    );
  }

  restoreService(
    contractedServiceId: string
  ): Promise<Result<boolean>> {
    return this.transition(
      contractedServiceId,
      ContractedServiceStatus.SUSPENDED,
      (service) => service.reactivate()
    );
  }

  private async transition(
    contractedServiceId: string,
    from: ContractedServiceStatus,
    change: (service: ContractedService) => Result<void>
  ): Promise<Result<boolean>> {
    const id = ContractedServiceId.parse(contractedServiceId);
    if (id.isFailure) {
      return Result.fail(`Invalid contractedServiceId: ${id.error}`);
    }

    const found = await this.contractedServiceRepository.findById(
      id.value
    );
    if (found.isFailure) return Result.fail(found.error!);
    const service = found.value;
    if (service === null || service.status !== from) {
      return Result.ok(false);
    }

    const changed = change(service);
    if (changed.isFailure) return Result.fail(changed.error!);
    const saved =
      await this.contractedServiceRepository.save(service);
    if (saved.isFailure) return Result.fail(saved.error!);
    return Result.ok(true);
  }
}
