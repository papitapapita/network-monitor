import { Result } from 'domain/shared/core';
import { AlertId } from 'domain/shared/ids';
import { IAlertRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { AlertMapper } from '../mappers';
import { AlertResponseDTO, ClearAlertDTO } from '../dtos';

export class ClearAlertUseCase extends UseCase<
  ClearAlertDTO,
  AlertResponseDTO
> {
  constructor(
    private readonly alertRepository: IAlertRepository,
    logger: ILogger
  ) {
    super(logger, 'ClearAlertUseCase');
  }

  protected async executeImpl(
    request: ClearAlertDTO
  ): Promise<Result<AlertResponseDTO>> {
    const idResult = AlertId.parse(request.id);
    if (idResult.isFailure) {
      return this.fail(`Invalid alert ID: ${idResult.error}`);
    }

    const found = await this.alertRepository.findById(idResult.value);
    if (found.isFailure) {
      return this.fail(`Failed to load alert: ${found.error}`);
    }
    if (found.value === null) {
      return this.fail('Alert not found');
    }

    const alert = found.value;
    const resolveResult = alert.resolve(new Date());
    if (resolveResult.isFailure) {
      // Clearing is idempotent — an already-resolved alert is a success
      // no-op, not an error, matching the automatic-resolve behaviour.
      if (resolveResult.error === 'Alert already resolved') {
        return this.ok(AlertMapper.toDTO(alert));
      }
      return this.fail(resolveResult.error);
    }

    const saveResult = await this.alertRepository.save(alert);
    if (saveResult.isFailure) {
      return this.fail(`Failed to save alert: ${saveResult.error}`);
    }

    return this.ok(AlertMapper.toDTO(saveResult.value));
  }
}
