import { Result } from 'domain/shared/core';
import {
  AlertThresholds,
  IAlertThresholdsRepository
} from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  AlertThresholdsDTO,
  GlobalAlertThresholdsResponseDTO
} from '../dtos';
import { AlertThresholdsMapper } from '../mappers';

// Replaced as a whole: the screen shows every threshold and saves them
// together. Takes effect on the next poll, with no restart (WLS-200).
export class UpdateAlertThresholdsUseCase extends UseCase<
  AlertThresholdsDTO,
  GlobalAlertThresholdsResponseDTO
> {
  constructor(
    private readonly repository: IAlertThresholdsRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateAlertThresholdsUseCase');
  }

  protected async executeImpl(
    request: AlertThresholdsDTO
  ): Promise<Result<GlobalAlertThresholdsResponseDTO>> {
    const thresholds = AlertThresholds.create(
      AlertThresholdsMapper.toProps(request)
    );
    if (thresholds.isFailure) return this.fail(thresholds.error!);

    const saved = await this.repository.saveGlobal(thresholds.value);
    if (saved.isFailure) {
      return this.fail(
        `Failed to save alert thresholds: ${saved.error}`
      );
    }
    return this.ok({
      thresholds: AlertThresholdsMapper.toDTO(thresholds.value),
      defaults: AlertThresholdsMapper.toDTO(
        AlertThresholds.defaults()
      )
    });
  }
}
