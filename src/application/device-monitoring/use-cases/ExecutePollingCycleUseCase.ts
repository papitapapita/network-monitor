import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';
import { DeviceState } from 'domain/device-monitoring/aggregates';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IPingService } from '../interfaces';
import { PollingMapper } from '../mappers';
import {
  IPingResultRepository,
  IDeviceStateRepository
} from 'domain/device-monitoring/repository';
import {
  ExecutePollingCycleDTO,
  SingleDevicePollingResultDTO
} from '../dtos';

export class ExecutePollingCycleUseCase extends UseCase<
  ExecutePollingCycleDTO,
  SingleDevicePollingResultDTO
> {
  constructor(
    private readonly pollingConfigRepo: IPollingConfigurationRepository,
    private readonly pingResultRepo: IPingResultRepository,
    private readonly deviceStateRepo: IDeviceStateRepository,
    private readonly pingService: IPingService,
    logger: ILogger
  ) {
    super(logger, 'ExecutePollingCycleUseCase');
  }

  protected async beforeExecute(
    request: ExecutePollingCycleDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Network device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: ExecutePollingCycleDTO
  ): Promise<Result<SingleDevicePollingResultDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;
    const { forceExecution = false } = request;
    const now = new Date();

    // 1. Load polling configuration
    const configResult =
      await this.pollingConfigRepo.findByDeviceId(deviceId);
    if (configResult.isFailure) {
      return this.fail(
        `Failed to load polling config: ${configResult.error}`
      );
    }

    const config = configResult.value;
    if (!config) {
      return this.fail(
        `No polling configuration found for device ${deviceId}`
      );
    }

    // 2. Skip if disabled (unless forced)
    if (!forceExecution && !config.enabled) {
      return this.ok(
        PollingMapper.toSkippedResultDTO(deviceId.toString(), now)
      );
    }

    // 3. Ensure IP address is present
    if (!config.ipAddress) {
      return this.fail(
        `Device ${deviceId} has no IP address configured for polling`
      );
    }

    // 4. Execute ping
    const pingResult = await this.pingService.ping(
      config.ipAddress.value
    );
    if (pingResult.isFailure) {
      return this.fail(`Ping execution error: ${pingResult.error}`);
    }

    const { isReachable, latencyMs } = pingResult.value;

    // 5. Persist ping result
    await this.pingResultRepo.save({
      deviceId,
      isReachable,
      latencyMs,
      checkedAt: now
    });

    // 6. Load or create DeviceState
    const stateResult =
      await this.deviceStateRepo.findByDeviceId(deviceId);
    if (stateResult.isFailure) {
      return this.fail(
        `Failed to load device state: ${stateResult.error}`
      );
    }

    const isFirstPoll = stateResult.value === null;
    const deviceState = isFirstPoll
      ? DeviceState.createInitial(deviceId)
      : stateResult.value!;

    // 7. Apply ping result — transition logic and events are here
    deviceState.applyPingResult(
      isReachable,
      latencyMs,
      config.failuresBeforeDown,
      now,
      isFirstPoll
    );

    // 8. Persist (repository dispatches events)
    await this.deviceStateRepo.save(deviceState);

    return this.ok(
      PollingMapper.toPollResultDTO({
        deviceId: deviceId.toString(),
        isReachable,
        latencyMs,
        isOnline: deviceState.isOnline,
        consecutiveFailures: deviceState.consecutiveFailures,
        timestamp: now
      })
    );
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return data;
  }
}
