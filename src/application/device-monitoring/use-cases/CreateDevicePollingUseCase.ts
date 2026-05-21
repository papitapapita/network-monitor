import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeviceId, PollingConfigurationId } from 'domain/shared/ids';
import { IPAddress } from 'domain/shared/value-objects';
import {
  PollingInterval,
  FailureThreshold
} from 'domain/device-monitoring/value-objects';
import { PollingConfiguration } from 'domain/device-monitoring/entities';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import {
  CreateDevicePollingDTO,
  PollingConfigurationDTO
} from '../dtos';

export class CreateDevicePollingUseCase extends UseCase<
  CreateDevicePollingDTO,
  PollingConfigurationDTO
> {
  constructor(
    private readonly pollingConfigRepo: IPollingConfigurationRepository,
    private readonly deviceRepo: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'CreateDevicePollingUseCase');
  }

  protected async beforeExecute(
    request: CreateDevicePollingDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: CreateDevicePollingDTO
  ): Promise<Result<PollingConfigurationDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail('Invalid Device ID');
    }
    const deviceId = deviceIdResult.value;

    const existsResult = await this.deviceRepo.exists(deviceId);
    if (existsResult.isFailure) {
      return this.fail(existsResult.error);
    }
    if (!existsResult.value) {
      return this.fail('Device not found');
    }

    const configResult =
      await this.pollingConfigRepo.findByDeviceId(deviceId);
    if (configResult.isFailure) {
      return this.fail(
        `Failed to load config: ${configResult.error}`
      );
    }

    const existingConfig = configResult.value;

    if (!existingConfig) {
      return this.createConfig(request, deviceId);
    }

    return this.updateConfig(request, existingConfig);
  }

  private async createConfig(
    request: CreateDevicePollingDTO,
    deviceId: DeviceId
  ): Promise<Result<PollingConfigurationDTO>> {
    let interval: PollingInterval;
    if (request.intervalSeconds !== undefined) {
      const intervalResult = PollingInterval.create(
        request.intervalSeconds
      );
      if (intervalResult.isFailure) {
        return this.fail(intervalResult.error);
      }
      interval = intervalResult.value;
    } else {
      interval = PollingInterval.createDefault();
    }

    let threshold: FailureThreshold;
    if (request.failuresBeforeDown !== undefined) {
      const thresholdResult = FailureThreshold.create(
        request.failuresBeforeDown
      );
      if (thresholdResult.isFailure) {
        return this.fail(thresholdResult.error);
      }
      threshold = thresholdResult.value;
    } else {
      threshold = FailureThreshold.createDefault();
    }

    let ipAddress: IPAddress | null = null;
    if (request.ipAddress != null) {
      const ipResult = IPAddress.create(request.ipAddress);
      if (ipResult.isFailure) {
        return this.fail(ipResult.error);
      }
      ipAddress = ipResult.value;
    }

    const newConfigResult = PollingConfiguration.create(
      {
        deviceId,
        ipAddress,
        interval,
        failuresBeforeDown: threshold,
        enabled: request.enabled ?? true
      },
      PollingConfigurationId.create()
    );

    if (newConfigResult.isFailure) {
      return this.fail(newConfigResult.error);
    }

    const saveResult = await this.pollingConfigRepo.save(
      newConfigResult.value
    );
    if (saveResult.isFailure) {
      return this.fail(`Failed to save config: ${saveResult.error}`);
    }

    return this.ok(this.toDTO(saveResult.value));
  }

  private async updateConfig(
    request: CreateDevicePollingDTO,
    config: PollingConfiguration
  ): Promise<Result<PollingConfigurationDTO>> {
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

    // 'ipAddress' key present in the DTO (including null) means update
    if ('ipAddress' in request) {
      let ipAddress: IPAddress | null = null;
      if (request.ipAddress != null) {
        const ipResult = IPAddress.create(request.ipAddress);
        if (ipResult.isFailure) {
          return this.fail(ipResult.error);
        }
        ipAddress = ipResult.value;
      }
      config.updateIpAddress(ipAddress);
    }

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

    return this.ok(this.toDTO(saveResult.value));
  }

  private toDTO(
    config: PollingConfiguration
  ): PollingConfigurationDTO {
    return {
      id: config.id.toString(),
      deviceId: config.deviceId.toString(),
      ipAddress: config.ipAddress?.value ?? null,
      intervalSeconds: config.interval.seconds,
      failuresBeforeDown: config.failuresBeforeDown.value,
      enabled: config.enabled
    };
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return data;
  }
}
