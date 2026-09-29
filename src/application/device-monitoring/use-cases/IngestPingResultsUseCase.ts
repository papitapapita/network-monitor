import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { DeviceState } from 'domain/device-monitoring/aggregates';
import {
  IDeviceStateRepository,
  IPingResultRepository,
  IPollingConfigurationRepository
} from 'domain/device-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IngestPingResultsDTO,
  IngestPingResultsResponseDTO
} from '../dtos';

// The "decide" half of a poll cycle: applies one measured outcome to history
// and DeviceState, whoever measured it — the in-process scheduler today, an
// on-site agent tomorrow.
export class IngestPingResultsUseCase extends UseCase<
  IngestPingResultsDTO,
  IngestPingResultsResponseDTO
> {
  constructor(
    private readonly pollingConfigRepo: IPollingConfigurationRepository,
    private readonly pingResultRepo: IPingResultRepository,
    private readonly deviceStateRepo: IDeviceStateRepository,
    logger: ILogger
  ) {
    super(logger, 'IngestPingResultsUseCase');
  }

  protected async beforeExecute(
    request: IngestPingResultsDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Network device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: IngestPingResultsDTO
  ): Promise<Result<IngestPingResultsResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;
    const { outcome, measuredAt } = request;

    if (outcome.kind === 'probe-unavailable') {
      return this.handleProbeUnavailable(deviceId, measuredAt);
    }

    // Monitoring can be turned off while a cycle is in flight — the attempt
    // loop runs for several seconds, and the suspend that clears the state is
    // dispatched without being awaited. Re-read before writing anything, or
    // this result resurrects the UNKNOWN status that was just set and can raise
    // an outage alert for a device nobody is watching any more.
    const configResult =
      await this.pollingConfigRepo.findByDeviceId(deviceId);
    const config = configResult.isSuccess ? configResult.value : null;
    if (config && !config.enabled) {
      return this.ok({ status: 'SKIPPED' });
    }

    const { isReachable, latencyMs } = outcome;

    // history sample only — losing it must not stop the state update below,
    // which is what drives alerting and scheduling
    const pingSaveResult = await this.pingResultRepo.save({
      deviceId,
      isReachable,
      latencyMs,
      checkedAt: measuredAt
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

    const deviceState =
      stateResult.value ?? DeviceState.createInitial(deviceId);

    deviceState.applyPingResult(isReachable, latencyMs, measuredAt);

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

    if (config) {
      config.markPolled(measuredAt);
      const configSaveResult =
        await this.pollingConfigRepo.save(config);
      if (configSaveResult.isFailure) {
        this.logger.warn('Failed to persist lastPolledAt', {
          deviceId: deviceId.toString(),
          error: configSaveResult.error
        });
      }
    } else {
      this.logger.warn(
        'Polling config unavailable — lastPolledAt not advanced',
        {
          deviceId: deviceId.toString(),
          error: configResult.isFailure ? configResult.error : null
        }
      );
    }

    return this.ok({
      status: 'APPLIED',
      isOnline: deviceState.isOnline,
      consecutiveFailures: deviceState.consecutiveFailures
    });
  }

  // The probe never ran, so device status is unknown and must not be rewritten.
  // Only an already-known device gets its lastCheckedAt advanced: seeding a row
  // here would make the next successful poll look like a recovery.
  private async handleProbeUnavailable(
    deviceId: DeviceId,
    measuredAt: Date
  ): Promise<Result<IngestPingResultsResponseDTO>> {
    const stateResult =
      await this.deviceStateRepo.findByDeviceId(deviceId);
    if (stateResult.isSuccess && stateResult.value !== null) {
      stateResult.value.applyPollFailure(measuredAt);
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

    return this.ok({ status: 'PROBE_UNAVAILABLE' });
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return data;
  }
}
