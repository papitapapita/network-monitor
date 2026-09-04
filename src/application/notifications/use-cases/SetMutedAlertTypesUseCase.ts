import { Result } from 'domain/shared/core';
import { IMutedAlertTypeRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  MutedAlertTypesResponseDTO,
  SetMutedAlertTypesDTO
} from '../dtos';

// Wholesale replace, not incremental add/remove — the muted-type list is
// short (a couple dozen wireless metrics plus device_unreachable) and read
// as a settings screen, not a growing collection.
export class SetMutedAlertTypesUseCase extends UseCase<
  SetMutedAlertTypesDTO,
  MutedAlertTypesResponseDTO
> {
  constructor(
    private readonly repository: IMutedAlertTypeRepository,
    logger: ILogger
  ) {
    super(logger, 'SetMutedAlertTypesUseCase');
  }

  protected async beforeExecute(
    request: SetMutedAlertTypesDTO
  ): Promise<Result<void> | null> {
    if (!Array.isArray(request.metrics)) {
      return Result.fail('metrics must be an array');
    }
    return null;
  }

  protected async executeImpl(
    request: SetMutedAlertTypesDTO
  ): Promise<Result<MutedAlertTypesResponseDTO>> {
    const result = await this.repository.replaceAll(
      request.metrics
    );
    if (result.isFailure) {
      return this.fail(
        `Failed to update muted alert types: ${result.error}`
      );
    }

    return this.ok({
      metrics: result.value.map((entity) => entity.metric)
    });
  }
}
