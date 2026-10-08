import { Result } from 'domain/shared/core';
import {
  AlertThresholds,
  IAlertThresholdsRepository
} from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { GlobalAlertThresholdsResponseDTO } from '../dtos';
import { AlertThresholdsMapper } from '../mappers';

export class GetAlertThresholdsUseCase extends UseCase<
  Record<string, never>,
  GlobalAlertThresholdsResponseDTO
> {
  constructor(
    private readonly repository: IAlertThresholdsRepository,
    logger: ILogger
  ) {
    super(logger, 'GetAlertThresholdsUseCase');
  }

  protected async executeImpl(): Promise<
    Result<GlobalAlertThresholdsResponseDTO>
  > {
    const result = await this.repository.getGlobal();
    if (result.isFailure) {
      return this.fail(
        `Failed to load alert thresholds: ${result.error}`
      );
    }
    return this.ok({
      thresholds: AlertThresholdsMapper.toDTO(result.value),
      defaults: AlertThresholdsMapper.toDTO(
        AlertThresholds.defaults()
      )
    });
  }
}
