import { Result } from 'domain/shared/core';
import { IRouterHealthThresholdsRepository } from 'domain/device-monitoring/repository';
import { RouterHealthThresholds } from 'domain/device-monitoring/value-objects';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { RouterHealthThresholdsResponseDTO } from '../dtos';

// MON-172
export class GetRouterHealthThresholdsUseCase extends UseCase<
  void,
  RouterHealthThresholdsResponseDTO
> {
  constructor(
    private readonly repository: IRouterHealthThresholdsRepository,
    logger: ILogger
  ) {
    super(logger, 'GetRouterHealthThresholdsUseCase');
  }

  protected async executeImpl(): Promise<
    Result<RouterHealthThresholdsResponseDTO>
  > {
    const result = await this.repository.get();
    if (result.isFailure) return Result.fail(result.error);
    return this.ok({
      thresholds: result.value.values,
      defaults: RouterHealthThresholds.defaults().values
    });
  }
}
