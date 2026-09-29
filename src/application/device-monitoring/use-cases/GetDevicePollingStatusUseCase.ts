import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import {
  IAgentStatusQuery,
  ILogger
} from 'application/shared/interfaces';
import { IPingResultRepository } from 'domain/device-monitoring/repository';
import { PollingMapper } from '../mappers';
import {
  GetDevicePollingStatusDTO,
  DevicePollingStatusDTO
} from '../dtos';
import {
  IPollingConfigurationRepository,
  IDeviceStateRepository
} from 'domain/device-monitoring/repository';
import { DeviceId } from 'domain/shared';

export class GetDevicePollingStatusUseCase extends UseCase<
  GetDevicePollingStatusDTO,
  DevicePollingStatusDTO
> {
  constructor(
    private readonly pollingConfigRepo: IPollingConfigurationRepository,
    private readonly deviceStateRepo: IDeviceStateRepository,
    private readonly pingResultRepo: IPingResultRepository,
    logger: ILogger,
    private readonly agentStatusQuery: IAgentStatusQuery
  ) {
    super(logger, 'GetDevicePollingStatusUseCase');
  }

  protected async beforeExecute(
    query: GetDevicePollingStatusDTO
  ): Promise<Result<void> | null> {
    if (!query.deviceId?.trim()) {
      return Result.fail('Network device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    query: GetDevicePollingStatusDTO
  ): Promise<Result<DevicePollingStatusDTO>> {
    const deviceIdResult = DeviceId.parse(query.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const configResult =
      await this.pollingConfigRepo.findByDeviceId(deviceId);
    if (configResult.isFailure) {
      return this.fail(
        `Failed to load polling config: ${configResult.error}`
      );
    }

    if (!configResult.value) {
      return this.fail(
        `No polling configuration found for device ${deviceId}`
      );
    }

    const config = configResult.value;

    const stateResult =
      await this.deviceStateRepo.findByDeviceId(deviceId);
    const state = stateResult.isSuccess ? stateResult.value : null;

    const latestPingsResult =
      await this.pingResultRepo.findLatestByDevice(deviceId, 1);
    const lastPing =
      latestPingsResult.isSuccess &&
      latestPingsResult.value.length > 0
        ? latestPingsResult.value[0]
        : null;

    return this.ok(
      PollingMapper.toStatusDTO(
        config,
        state,
        lastPing,
        await this.isUnmeasured(deviceId)
      )
    );
  }

  // R7. A failed read falls back to the stored state: this is a display, and
  // showing the last known status beats failing the whole screen.
  private async isUnmeasured(deviceId: DeviceId): Promise<boolean> {
    const id = deviceId.toString();
    const result = await this.agentStatusQuery.findUnmeasuredDevices([
      id
    ]);
    if (result.isFailure) {
      this.logger.warn(
        'Agent status unavailable for polling status',
        {
          deviceId: id,
          error: result.error
        }
      );
      return false;
    }
    return result.value.has(id);
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return data;
  }
}
