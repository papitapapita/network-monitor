import { Result } from 'domain/shared/core';
import { IRouterHealthThresholdsRepository } from 'domain/device-monitoring/repository';
import { RouterHealthThresholds } from 'domain/device-monitoring/value-objects';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  RouterHealthThresholdsResponseDTO,
  UpdateRouterHealthThresholdsRequestDTO
} from '../dtos';

// MON-172: replaced as a whole, and used from the next check on with no
// restart.
export class UpdateRouterHealthThresholdsUseCase extends UseCase<
  UpdateRouterHealthThresholdsRequestDTO,
  RouterHealthThresholdsResponseDTO
> {
  constructor(
    private readonly repository: IRouterHealthThresholdsRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateRouterHealthThresholdsUseCase');
  }

  protected async executeImpl(
    request: UpdateRouterHealthThresholdsRequestDTO
  ): Promise<Result<RouterHealthThresholdsResponseDTO>> {
    const thresholds = RouterHealthThresholds.create({
      cpuPercent: request.cpuPercent,
      minFreeMemoryPercent: request.minFreeMemoryPercent,
      minFreeDiskPercent: request.minFreeDiskPercent,
      maxTemperatureC: request.maxTemperatureC,
      minVoltage: request.minVoltage
    });
    if (thresholds.isFailure) return this.fail(thresholds.error!);

    const saved = await this.repository.save(thresholds.value);
    if (saved.isFailure) return Result.fail(saved.error);
    return this.ok({
      thresholds: thresholds.value.values,
      defaults: RouterHealthThresholds.defaults().values
    });
  }
}
