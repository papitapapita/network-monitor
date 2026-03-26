import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  PollingInterval,
  FailureThreshold
} from 'domain/device-monitoring/value-objects';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';
import { ConfigureDevicePollingDTO } from '../dtos';
import { DeviceId } from 'domain/shared';

export class ConfigureDevicePollingUseCase extends UseCase<
  ConfigureDevicePollingDTO,
  void
> {
  constructor(
    private readonly pollingConfigRepo: IPollingConfigurationRepository,
    logger: ILogger
  ) {
    super(logger, 'ConfigureDevicePollingUseCase');
  }

  protected async beforeExecute(
    request: ConfigureDevicePollingDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: ConfigureDevicePollingDTO
  ): Promise<Result<void>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid Device ID: ${deviceIdResult.error}`);
    }

    const configResult = await this.pollingConfigRepo.findByDeviceId(
      deviceIdResult.value
    );
    if (configResult.isFailure) {
      return this.fail(
        `Failed to load config: ${configResult.error}`
      );
    }

    const config = configResult.value;
    if (!config) {
      return this.fail(
        `No polling configuration found for device ${request.deviceId}`
      );
    }

    if (request.intervalSeconds !== undefined) {
      const intervalResult = PollingInterval.create(
        request.intervalSeconds
      );
      if (intervalResult.isFailure) {
        return this.fail(intervalResult.error);
      }

      const updateResult = config.updateInterval(
        intervalResult.value
      );
      if (updateResult.isFailure) {
        return this.fail(updateResult.error);
      }
    }

    // Delegate failure threshold validation to the FailureThreshold value object
    if (request.failuresBeforeDown !== undefined) {
      const thresholdResult = FailureThreshold.create(
        request.failuresBeforeDown
      );
      if (thresholdResult.isFailure) {
        return this.fail(thresholdResult.error);
      }

      const updateResult = config.updateFailureThreshold(
        thresholdResult.value
      );
      if (updateResult.isFailure) {
        return this.fail(updateResult.error);
      }
    }

    // Delegate enable/disable to the entity
    if (request.enabled !== undefined) {
      if (request.enabled) {
        config.enable();
      } else {
        config.disable();
      }
    }

    const saveResult = await this.pollingConfigRepo.save(config);
    if (saveResult.isFailure) {
      return this.fail(`Failed to save config: ${saveResult.error}`);
    }

    return this.ok(undefined);
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return data;
  }
}
