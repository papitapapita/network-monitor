import { ServicePlanId } from 'domain/shared/ids';
import {
  IServicePlanRepository,
  IContractedServiceRepository
} from 'domain/customers/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeleteServicePlanRequestDTO } from '../dtos';

export class DeleteServicePlanUseCase extends UseCase<
  DeleteServicePlanRequestDTO,
  void
> {
  constructor(
    private readonly servicePlanRepository: IServicePlanRepository,
    private readonly contractedServiceRepository: IContractedServiceRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteServicePlanUseCase');
  }

  protected async beforeExecute(
    request: DeleteServicePlanRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Service plan ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: DeleteServicePlanRequestDTO
  ): Promise<Result<void>> {
    const idResult = ServicePlanId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid service plan ID: ${idResult.error}`);
    }

    const findResult = await this.servicePlanRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Service plan not found: ${request.id}`);
    }

    // Guard: cannot delete a plan still referenced by contracted services
    const servicesResult =
      await this.contractedServiceRepository.findByServicePlanId(
        idResult.value
      );
    if (servicesResult.isFailure) {
      return this.fail(servicesResult.error!);
    }
    if (servicesResult.value.length > 0) {
      return this.fail(
        `Cannot delete service plan: it is referenced by ${servicesResult.value.length} contracted service(s).`
      );
    }

    const deleteResult = await this.servicePlanRepository.delete(
      idResult.value
    );
    if (deleteResult.isFailure) {
      return this.fail(deleteResult.error!);
    }

    return this.ok(undefined);
  }
}
