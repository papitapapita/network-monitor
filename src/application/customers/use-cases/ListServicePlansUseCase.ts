import { IServicePlanRepository } from 'domain/customers/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ServicePlanMapper } from '../mappers';
import {
  ListServicePlansQueryDTO,
  ServicePlanListResponseDTO
} from '../dtos';

export class ListServicePlansUseCase extends UseCase<
  ListServicePlansQueryDTO,
  ServicePlanListResponseDTO
> {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;

  constructor(
    private readonly servicePlanRepository: IServicePlanRepository,
    logger: ILogger
  ) {
    super(logger, 'ListServicePlansUseCase');
  }

  protected async executeImpl(
    request: ListServicePlansQueryDTO
  ): Promise<Result<ServicePlanListResponseDTO>> {
    const limit = Math.min(
      request.limit ?? ListServicePlansUseCase.DEFAULT_LIMIT,
      ListServicePlansUseCase.MAX_LIMIT
    );
    const offset = request.offset ?? 0;

    const plansResult = await this.servicePlanRepository.findAll(
      limit,
      offset
    );
    if (plansResult.isFailure) {
      return this.fail(plansResult.error!);
    }

    const countResult = await this.servicePlanRepository.count();
    if (countResult.isFailure) {
      return this.fail(countResult.error!);
    }

    return this.ok(
      ServicePlanMapper.toListDTO(
        plansResult.value,
        countResult.value,
        limit,
        offset
      )
    );
  }
}
