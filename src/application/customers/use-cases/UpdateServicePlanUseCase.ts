import { ServicePlanId } from 'domain/shared/ids';
import { IServicePlanRepository } from 'domain/customers/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ServicePlanMapper } from '../mappers';
import {
  UpdateServicePlanRequestDTO,
  ServicePlanResponseDTO
} from '../dtos';

export class UpdateServicePlanUseCase extends UseCase<
  UpdateServicePlanRequestDTO,
  ServicePlanResponseDTO
> {
  constructor(
    private readonly servicePlanRepository: IServicePlanRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateServicePlanUseCase');
  }

  protected async beforeExecute(
    request: UpdateServicePlanRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Service plan ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: UpdateServicePlanRequestDTO
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

    const plan = findResult.value;
    const data = ServicePlanMapper.extractUpdateData(request);

    if (data.name !== undefined) {
      const newName = data.name.trim();
      const existing =
        await this.servicePlanRepository.findByName(newName);
      if (existing.isFailure) {
        return this.fail(existing.error!);
      }
      if (
        existing.value !== null &&
        !existing.value.id.equals(plan.id)
      ) {
        return this.fail(
          `A service plan with name "${newName}" already exists`
        );
      }
      const renameResult = plan.rename(newName);
      if (renameResult.isFailure) {
        return this.fail(renameResult.error!);
      }
    }

    if (
      data.downloadMbps !== undefined ||
      data.uploadMbps !== undefined
    ) {
      const download = data.downloadMbps ?? plan.downloadMbps;
      const upload = data.uploadMbps ?? plan.uploadMbps;
      const bandwidthResult = plan.updateBandwidth(download, upload);
      if (bandwidthResult.isFailure) {
        return this.fail(bandwidthResult.error!);
      }
    }

    if (data.monthlyPrice !== undefined) {
      const priceResult = plan.updatePricing(data.monthlyPrice);
      if (priceResult.isFailure) {
        return this.fail(priceResult.error!);
      }
    }

    if (data.description !== undefined) {
      const descResult = plan.updateDescription(data.description);
      if (descResult.isFailure) {
        return this.fail(descResult.error!);
      }
    }

    if (data.isActive !== undefined) {
      const activeResult = data.isActive
        ? plan.activate()
        : plan.deactivate();
      if (activeResult.isFailure) {
        return this.fail(activeResult.error!);
      }
    }

    const saveResult = await this.servicePlanRepository.save(plan);
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist service plan: ${saveResult.error}`
      );
    }

    return this.ok(ServicePlanMapper.toDTO(saveResult.value));
  }
}
