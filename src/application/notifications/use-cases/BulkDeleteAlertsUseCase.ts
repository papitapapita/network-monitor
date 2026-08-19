import { Result } from 'domain/shared/core';
import { AlertId } from 'domain/shared/ids';
import { IAlertRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  BulkDeleteAlertsDTO,
  BulkDeleteAlertsResponseDTO
} from '../dtos';

export class BulkDeleteAlertsUseCase extends UseCase<
  BulkDeleteAlertsDTO,
  BulkDeleteAlertsResponseDTO
> {
  constructor(
    private readonly alertRepository: IAlertRepository,
    logger: ILogger
  ) {
    super(logger, 'BulkDeleteAlertsUseCase');
  }

  protected async beforeExecute(
    request: BulkDeleteAlertsDTO
  ): Promise<Result<void> | null> {
    if (!request.ids || request.ids.length === 0) {
      return Result.fail('ids is required and must not be empty');
    }
    return null;
  }

  protected async executeImpl(
    request: BulkDeleteAlertsDTO
  ): Promise<Result<BulkDeleteAlertsResponseDTO>> {
    const deleted: string[] = [];
    const skipped: { id: string; reason: string }[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const rawId of request.ids) {
      const idResult = AlertId.parse(rawId);
      if (idResult.isFailure) {
        failed.push({
          id: rawId,
          error: `Invalid alert ID: ${idResult.error}`
        });
        continue;
      }

      const found = await this.alertRepository.findById(
        idResult.value
      );
      if (found.isFailure) {
        failed.push({ id: rawId, error: found.error });
        continue;
      }
      if (found.value === null) {
        failed.push({ id: rawId, error: 'Alert not found' });
        continue;
      }
      if (found.value.isOpen) {
        skipped.push({
          id: rawId,
          reason: 'Cannot delete an alert that is still open'
        });
        continue;
      }

      const deleteResult = await this.alertRepository.deleteById(
        idResult.value
      );
      if (deleteResult.isFailure) {
        failed.push({ id: rawId, error: deleteResult.error });
        continue;
      }

      deleted.push(rawId);
    }

    return this.ok({ deleted, skipped, failed });
  }
}
