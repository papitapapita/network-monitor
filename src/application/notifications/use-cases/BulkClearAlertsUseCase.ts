import { Result } from 'domain/shared/core';
import { AlertId, DeviceId } from 'domain/shared/ids';
import { Alert } from 'domain/notifications/aggregates';
import { IAlertRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { AlertMapper } from '../mappers';
import {
  BulkClearAlertsDTO,
  BulkClearAlertsResponseDTO
} from '../dtos';

export class BulkClearAlertsUseCase extends UseCase<
  BulkClearAlertsDTO,
  BulkClearAlertsResponseDTO
> {
  constructor(
    private readonly alertRepository: IAlertRepository,
    logger: ILogger
  ) {
    super(logger, 'BulkClearAlertsUseCase');
  }

  protected async beforeExecute(
    request: BulkClearAlertsDTO
  ): Promise<Result<void> | null> {
    const hasIds = !!request.ids && request.ids.length > 0;
    const hasDeviceId = !!request.deviceId;
    if (hasIds === hasDeviceId) {
      return Result.fail(
        'Exactly one of ids or deviceId is required'
      );
    }
    return null;
  }

  protected async executeImpl(
    request: BulkClearAlertsDTO
  ): Promise<Result<BulkClearAlertsResponseDTO>> {
    const skipped: { id: string; reason: string }[] = [];
    const failed: { id: string; error: string }[] = [];

    const targets = request.deviceId
      ? await this.loadOpenByDevice(request.deviceId, failed)
      : await this.loadByIds(request.ids ?? [], failed);

    if (targets === null) {
      return this.fail(failed[0]?.error ?? 'Failed to load alerts');
    }

    const cleared: BulkClearAlertsResponseDTO['cleared'] = [];
    for (const alert of targets) {
      const resolveResult = alert.resolve(new Date());
      if (resolveResult.isFailure) {
        skipped.push({
          id: alert.id.toString(),
          reason: resolveResult.error
        });
        continue;
      }

      const saveResult = await this.alertRepository.save(alert);
      if (saveResult.isFailure) {
        failed.push({
          id: alert.id.toString(),
          error: saveResult.error
        });
        continue;
      }

      cleared.push(AlertMapper.toDTO(saveResult.value));
    }

    return this.ok({ cleared, skipped, failed });
  }

  private async loadOpenByDevice(
    rawDeviceId: string,
    failed: { id: string; error: string }[]
  ): Promise<Alert[] | null> {
    const deviceIdResult = DeviceId.parse(rawDeviceId);
    if (deviceIdResult.isFailure) {
      failed.push({
        id: '',
        error: `Invalid device ID: ${deviceIdResult.error}`
      });
      return null;
    }

    const openResult =
      await this.alertRepository.findAllOpenByDeviceId(
        deviceIdResult.value
      );
    if (openResult.isFailure) {
      failed.push({ id: '', error: openResult.error });
      return null;
    }
    return openResult.value;
  }

  private async loadByIds(
    ids: string[],
    failed: { id: string; error: string }[]
  ): Promise<Alert[]> {
    const targets: Alert[] = [];
    for (const rawId of ids) {
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

      targets.push(found.value);
    }
    return targets;
  }
}
