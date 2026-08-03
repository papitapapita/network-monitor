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
import { PollingMapper } from '../mappers';
import { SuspendDeviceMonitoringUseCase } from './SuspendDeviceMonitoringUseCase';

export class CreateDevicePollingUseCase extends UseCase<
  CreateDevicePollingDTO,
  PollingConfigurationDTO
> {
  constructor(
    private readonly pollingConfigRepo: IPollingConfigurationRepository,
    private readonly deviceRepo: IDeviceRepository,
    private readonly suspendDeviceMonitoring: SuspendDeviceMonitoringUseCase,
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
        // defaults on, but only when there is an IP to poll — an explicit
        // `enabled: true` without one is rejected by the entity
        enabled: request.enabled ?? ipAddress !== null
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

    return this.ok(PollingMapper.toDTO(saveResult.value));
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

    // disable before touching the IP so a request that clears the IP and
    // turns polling off in one call doesn't trip the enabled/IP invariant
    if (request.enabled === false) {
      config.disable();
    }

    // `'ipAddress' in request` distinguishes explicit null (clear) from omitted (skip)
    if ('ipAddress' in request) {
      let ipAddress: IPAddress | null = null;
      if (request.ipAddress != null) {
        const ipResult = IPAddress.create(request.ipAddress);
        if (ipResult.isFailure) {
          return this.fail(ipResult.error);
        }
        ipAddress = ipResult.value;
      }
      const ipUpdateResult = config.updateIpAddress(ipAddress);
      if (ipUpdateResult.isFailure) {
        return this.fail(ipUpdateResult.error);
      }
    }

    if (request.enabled === true) {
      const enableResult = config.enable();
      if (enableResult.isFailure) {
        return this.fail(enableResult.error);
      }
    }

    const saveResult = await this.pollingConfigRepo.save(config);
    if (saveResult.isFailure) {
      return this.fail(`Failed to save config: ${saveResult.error}`);
    }

    // Same transition as turning monitoring off (MON-002) — blank the stored
    // reachability and close the open alert rather than leaving a reading
    // nothing will ever correct. The config is already disabled above, so this
    // only completes the rest of the transition.
    if (request.enabled === false) {
      const suspendResult =
        await this.suspendDeviceMonitoring.execute(config.deviceId);
      if (suspendResult.isFailure) {
        return this.fail(suspendResult.error);
      }
    }

    return this.ok(PollingMapper.toDTO(saveResult.value));
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return data;
  }
}
