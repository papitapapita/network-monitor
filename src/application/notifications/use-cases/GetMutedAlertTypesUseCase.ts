import { Result } from 'domain/shared/core';
import { IMutedAlertTypeRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { MutedAlertTypesResponseDTO } from '../dtos';

export class GetMutedAlertTypesUseCase extends UseCase<
  Record<string, never>,
  MutedAlertTypesResponseDTO
> {
  constructor(
    private readonly repository: IMutedAlertTypeRepository,
    logger: ILogger
  ) {
    super(logger, 'GetMutedAlertTypesUseCase');
  }

  protected async executeImpl(): Promise<
    Result<MutedAlertTypesResponseDTO>
  > {
    const result = await this.repository.listAll();
    if (result.isFailure) {
      return this.fail(
        `Failed to load muted alert types: ${result.error}`
      );
    }

    return this.ok({
      metrics: result.value.map((entity) => entity.metric)
    });
  }
}
