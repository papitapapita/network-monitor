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

// A result measured more than this long before it arrived is history only:
// live results reach the backend within seconds, so only an agent's buffered
// backlog is ever this old (ADR 0002, R9). Fixed, not tied to the poll
// interval, for that reason.
export const LIVE_RESULT_WINDOW_MS = 2 * 60 * 1000;

// The "decide" half of a poll cycle: applies one measured outcome to history
// and DeviceState, whoever measured it — the in-process scheduler or an
// on-site agent.
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
    const { outcome, measuredAt, source } = request;
    const live =
      source === undefined ||
      source.receivedAt.getTime() - measuredAt.getTime() <=
        LIVE_RESULT_WINDOW_MS;

    if (outcome.kind === 'probe-unavailable') {
      return this.handleProbeUnavailable(deviceId, measuredAt, live);
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

    const sample = {
      deviceId,
      isReachable,
      latencyMs,
      checkedAt: measuredAt
    };
    if (source) {
      // A sent-in result is stored first and exactly once. A failure here
      // fails the ingest, so the sender keeps the result and resends it; a
      // duplicate was fully handled the first time (R8).
      const saveResult = await this.pingResultRepo.saveOnce({
        ...sample,
        sourceResultId: source.resultId
      });
      if (saveResult.isFailure) {
        return this.fail(
          `Failed to store ping result: ${saveResult.error}`
        );
      }
      if (!saveResult.value) return this.ok({ status: 'DUPLICATE' });
    } else {
      // history sample only — losing it must not stop the state update
      // below, which is what drives alerting and scheduling
      const pingSaveResult = await this.pingResultRepo.save(sample);
      if (pingSaveResult.isFailure) {
        this.logger.warn('Failed to persist ping result', {
          deviceId: deviceId.toString(),
          error: pingSaveResult.error
        });
      }
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

    // R9/R10: an old or out-of-order result fills graphs and uptime but
    // changes no state, so an outage that began and ended while an agent was
    // offline is recorded and never alerted.
    if (!live || !deviceState.isNewerThanLastCheck(measuredAt)) {
      return this.ok({ status: 'HISTORY_ONLY' });
    }

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
  // A stale or out-of-order one is dropped: it has no history to fill.
  private async handleProbeUnavailable(
    deviceId: DeviceId,
    measuredAt: Date,
    live: boolean
  ): Promise<Result<IngestPingResultsResponseDTO>> {
    const stateResult =
      await this.deviceStateRepo.findByDeviceId(deviceId);
    if (
      live &&
      stateResult.isSuccess &&
      stateResult.value !== null &&
      stateResult.value.isNewerThanLastCheck(measuredAt)
    ) {
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
