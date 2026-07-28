import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IAlertRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ResolveAlertDTO } from '../dtos';

/**
 * Resolves the open alert for (device, type) in the shared alert store.
 * Idempotent: a no-op if none is open. Producers call this when their
 * condition clears so the unified alert list reflects the resolution.
 */
export class ResolveAlertUseCase extends UseCase<ResolveAlertDTO, void> {
  constructor(
    private readonly alertRepository: IAlertRepository,
    logger: ILogger
  ) {
    super(logger, 'ResolveAlertUseCase');
  }

  protected async executeImpl(
    request: ResolveAlertDTO
  ): Promise<Result<void>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }

    const openResult =
      await this.alertRepository.findOpenByDeviceAndType(
        deviceIdResult.value,
        request.type
      );
    if (openResult.isFailure) {
      return this.fail(
        `Failed to load open alert: ${openResult.error}`
      );
    }
    if (openResult.value === null) {
      return this.ok(undefined);
    }

    const resolveResult = openResult.value.resolve(request.resolvedAt);
    if (resolveResult.isFailure) {
      return this.fail(resolveResult.error);
    }

    const saveResult = await this.alertRepository.save(
      openResult.value
    );
    if (saveResult.isFailure) {
      return this.fail(`Failed to save alert: ${saveResult.error}`);
    }

    return this.ok(undefined);
  }
}
