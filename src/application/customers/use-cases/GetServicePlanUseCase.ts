import { ServicePlanId } from 'domain/shared/ids';
import { IServicePlanRepository } from 'domain/customers/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ServicePlanMapper } from '../mappers';
import {
  GetServicePlanRequestDTO,
  ServicePlanResponseDTO
} from '../dtos';

export class GetServicePlanUseCase extends UseCase<
  GetServicePlanRequestDTO,
  ServicePlanResponseDTO
> {
  constructor(
    private readonly servicePlanRepository: IServicePlanRepository,
    logger: ILogger
  ) {
    super(logger, 'GetServicePlanUseCase');
  }

  protected async beforeExecute(
    request: GetServicePlanRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Service plan ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetServicePlanRequestDTO
  ): Promise<Result<ServicePlanResponseDTO>> {
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

    return this.ok(ServicePlanMapper.toDTO(findResult.value));
  }
}
