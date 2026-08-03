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
import { PollingMapper } from '../mappers';
import { SuspendDeviceMonitoringUseCase } from './SuspendDeviceMonitoringUseCase';

export class ConfigureDevicePollingUseCase extends UseCase<
  ConfigureDevicePollingDTO,
  void
> {
  constructor(
    private readonly pollingConfigRepo: IPollingConfigurationRepository,
    private readonly suspendDeviceMonitoring: SuspendDeviceMonitoringUseCase,
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

    const updates = PollingMapper.extractUpdateData(request);

    if (updates.intervalSeconds !== undefined) {
      const intervalResult = PollingInterval.create(
        updates.intervalSeconds
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

    if (updates.failuresBeforeDown !== undefined) {
      const thresholdResult = FailureThreshold.create(
        updates.failuresBeforeDown
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

    if (updates.enabled === true) {
      const enableResult = config.enable();
      if (enableResult.isFailure) {
        return this.fail(enableResult.error);
      }
    }

    const saveResult = await this.pollingConfigRepo.save(config);
    if (saveResult.isFailure) {
      return this.fail(`Failed to save config: ${saveResult.error}`);
    }

    // Stopping polling here is the same transition as turning monitoring off
    // (MON-002), so it goes through the same writer: the stored reachability
    // must not stay frozen at its last reading, and the open availability alert
    // would otherwise never resolve. Runs after the save above so the interval
    // and threshold changes in the same request are not lost.
    if (updates.enabled === false) {
      const suspendResult =
        await this.suspendDeviceMonitoring.execute(
          deviceIdResult.value
        );
      if (suspendResult.isFailure) {
        return this.fail(suspendResult.error);
      }
    }

    return this.ok(undefined);
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return data;
  }
}
