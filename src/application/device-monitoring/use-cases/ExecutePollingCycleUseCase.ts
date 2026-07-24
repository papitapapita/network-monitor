import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';
import { DeviceState } from 'domain/device-monitoring/aggregates';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IPingService,
  IProbeHealthReporter,
  NullProbeHealthReporter
} from '../interfaces';
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
    logger: ILogger,
    private readonly retryDelayMs: number = 1_000,
    private readonly probeHealth: IProbeHealthReporter = NullProbeHealthReporter
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

    if (!forceExecution && !config.enabled) {
      return this.ok(
        PollingMapper.toSkippedResultDTO(deviceId.toString(), now)
      );
    }

    if (!config.ipAddress) {
      return this.fail(
        `Device ${deviceId} has no IP address configured for polling`
      );
    }

    // failuresBeforeDown doubles as the intra-cycle attempt budget: the device
    // is only considered unreachable after all attempts fail within one cycle.
    const maxAttempts = config.failuresBeforeDown.value;
    let isReachable = false;
    let latencyMs: number | null = null;
    // A failure to *run* the probe is a local fault, not an unreachable device.
    // Retry through it — spawn errors are often transient under load — and only
    // give up if no attempt ever produced a real answer.
    let probeRan = false;
    let lastProbeError: string | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelayMs)
        );
      }
      const pingResult = await this.pingService.ping(
        config.ipAddress.value
      );
      if (pingResult.isFailure) {
        lastProbeError = pingResult.error;
        continue;
      }
      probeRan = true;
      if (pingResult.value.isReachable) {
        isReachable = true;
        latencyMs = pingResult.value.latencyMs;
        break;
      }
    }

    if (!probeRan) {
      return this.handleProbeUnavailable(
        deviceId,
        now,
        lastProbeError ?? 'unknown error'
      );
    }
    this.probeHealth.recordProbeExecuted(deviceId.toString());

    // history sample only — losing it must not stop the state update below,
    // which is what drives alerting and scheduling
    const pingSaveResult = await this.pingResultRepo.save({
      deviceId,
      isReachable,
      latencyMs,
      checkedAt: now
    });
    if (pingSaveResult.isFailure) {
      this.logger.warn('Failed to persist ping result', {
        deviceId: deviceId.toString(),
        error: pingSaveResult.error
      });
    }

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

    deviceState.applyPingResult(
      isReachable,
      latencyMs,
      now,
      isFirstPoll
    );

    // DeviceState save first: its repository dispatches domain events
    // (online/offline transitions). Config save is housekeeping only.
    // A failure here must surface: the in-memory aggregate would otherwise
    // report a transition that was never persisted, and last_checked_at would
    // stay stale, re-queueing the device on every scheduler tick.
    const stateSaveResult =
      await this.deviceStateRepo.save(deviceState);
    if (stateSaveResult.isFailure) {
      return this.fail(
        `Failed to save device state: ${stateSaveResult.error}`
      );
    }

    config.markPolled(now);
    const configSaveResult =
      await this.pollingConfigRepo.save(config);
    if (configSaveResult.isFailure) {
      this.logger.warn('Failed to persist lastPolledAt', {
        deviceId: deviceId.toString(),
        error: configSaveResult.error
      });
    }

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

  // The probe never ran, so device status is unknown and must not be rewritten.
  // Only an already-known device gets its lastCheckedAt advanced: seeding a row
  // here would make the next successful poll look like a recovery.
  private async handleProbeUnavailable(
    deviceId: DeviceId,
    now: Date,
    error: string
  ): Promise<Result<SingleDevicePollingResultDTO>> {
    this.probeHealth.recordProbeExecutionFailure(
      deviceId.toString(),
      error
    );

    const stateResult =
      await this.deviceStateRepo.findByDeviceId(deviceId);
    if (stateResult.isSuccess && stateResult.value !== null) {
      stateResult.value.applyPollFailure(now);
      const saveResult = await this.deviceStateRepo.save(
        stateResult.value
      );
      if (saveResult.isFailure) {
        this.logger.warn('Failed to record probe attempt', {
          deviceId: deviceId.toString(),
          error: saveResult.error
        });
      }
    }

    return this.fail(`Ping execution error: ${error}`);
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return data;
  }
}
