import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { Alert } from 'domain/notifications/aggregates';
import { IAlertRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { OpenAlertDTO } from '../dtos';

/**
 * Persists an operational alert into the shared alert store, deduplicated by
 * (device, type). Does not notify — delivery is a separate concern. Any
 * producer BC records alerts through this (via IAlertRecorder) so they surface
 * in the unified alert list.
 */
export class OpenAlertUseCase extends UseCase<OpenAlertDTO, void> {
  constructor(
    private readonly alertRepository: IAlertRepository,
    logger: ILogger
  ) {
    super(logger, 'OpenAlertUseCase');
  }

  protected async executeImpl(
    request: OpenAlertDTO
  ): Promise<Result<void>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const existing =
      await this.alertRepository.findOpenByDeviceAndType(
        deviceId,
        request.type
      );
    if (existing.isFailure) {
      return this.fail(
        `Failed to check existing alerts: ${existing.error}`
      );
    }
    if (existing.value !== null) {
      // Already open — idempotent; producers re-emit every cycle.
      return this.ok(undefined);
    }

    const alertResult = Alert.open(
      deviceId,
      request.severity,
      request.source,
      request.type,
      request.description,
      request.details
    );
    if (alertResult.isFailure) {
      return this.fail(`Failed to create alert: ${alertResult.error}`);
    }

    const saveResult = await this.alertRepository.save(
      alertResult.value
    );
    if (saveResult.isFailure) {
      return this.fail(`Failed to save alert: ${saveResult.error}`);
    }

    return this.ok(undefined);
  }
}
