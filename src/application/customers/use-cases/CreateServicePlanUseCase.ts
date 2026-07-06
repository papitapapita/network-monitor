import { ServicePlan } from 'domain/customers';
import { IServicePlanRepository } from 'domain/customers/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ServicePlanMapper } from '../mappers';
import {
  CreateServicePlanRequestDTO,
  ServicePlanResponseDTO
} from '../dtos';

export class CreateServicePlanUseCase extends UseCase<
  CreateServicePlanRequestDTO,
  ServicePlanResponseDTO
> {
  constructor(
    private readonly servicePlanRepository: IServicePlanRepository,
    logger: ILogger
  ) {
    super(logger, 'CreateServicePlanUseCase');
  }

  protected async beforeExecute(
    request: CreateServicePlanRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.name || request.name.trim().length === 0) {
      return Result.fail('Service plan name is required');
    }
    return null;
  }

  protected async executeImpl(
    request: CreateServicePlanRequestDTO
  ): Promise<Result<ServicePlanResponseDTO>> {
    const data = ServicePlanMapper.extractCreateData(request);

    const existing = await this.servicePlanRepository.findByName(
      data.name.trim()
    );
    if (existing.isFailure) {
      return this.fail(existing.error!);
    }
    if (existing.value !== null) {
      return this.fail(
        `A service plan with name "${data.name.trim()}" already exists`
      );
    }

    const planResult = ServicePlan.create({
      name: data.name.trim(),
      downloadMbps: data.downloadMbps,
      uploadMbps: data.uploadMbps,
      monthlyPrice: data.monthlyPrice,
      description: data.description,
      isActive: data.isActive
    });
    if (planResult.isFailure) {
      return this.fail(planResult.error!);
    }

    const saveResult = await this.servicePlanRepository.save(
      planResult.value
    );
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist service plan: ${saveResult.error}`
      );
    }

    return this.ok(ServicePlanMapper.toDTO(saveResult.value));
  }
}
