import { Result } from 'domain/shared/core';
import { AlertId } from 'domain/shared/ids';
import { IAlertRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { AlertMapper } from '../mappers';
import { AlertResponseDTO, GetAlertByIdDTO } from '../dtos';

export class GetAlertByIdUseCase extends UseCase<
  GetAlertByIdDTO,
  AlertResponseDTO
> {
  constructor(
    private readonly alertRepository: IAlertRepository,
    logger: ILogger
  ) {
    super(logger, 'GetAlertByIdUseCase');
  }

  protected async executeImpl(
    request: GetAlertByIdDTO
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

    return this.ok(AlertMapper.toDTO(found.value));
  }
}
