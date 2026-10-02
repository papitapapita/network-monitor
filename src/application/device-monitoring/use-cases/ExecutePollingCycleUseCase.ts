import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { IDeviceEligibilityService } from 'domain/device-inventory/services';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  AgentPingRefusal,
  IAgentPingProbe,
  IProbeHealthReporter,
  NoAgentPingProbe,
  NullProbeHealthReporter
} from '../interfaces';
import { PollingMapper } from '../mappers';
import { PingCycleOutcome, PingCycleProbe } from '../services';
import {
  ExecutePollingCycleDTO,
  SingleDevicePollingResultDTO
} from '../dtos';
import { IngestPingResultsUseCase } from './IngestPingResultsUseCase';

// Shared with the controller, which answers 409 when a failure carries it.
export const NOT_ON_MONITORED_NETWORK =
  'this server is not on the monitored network';

// MON-022: why a manual poll through an agent got no reading. Shared with the
// controller, which picks the status code from them.
export const AGENT_POLL_FAILURES: Record<AgentPingRefusal, string> = {
  AGENT_OFFLINE: 'its on-site agent is not connected',
  PROBE_UNSUPPORTED:
    'its on-site agent must be updated to poll it on demand',
  TIMEOUT: 'its on-site agent did not answer in time',
  AGENT_ERROR: 'its on-site agent could not poll it'
};

// The in-process poll: decides whether the device may be polled, measures it
// with PingCycleProbe and hands the outcome to IngestPingResultsUseCase.
export class ExecutePollingCycleUseCase extends UseCase<
  ExecutePollingCycleDTO,
  SingleDevicePollingResultDTO
> {
  private static readonly MANUAL_POLL_MAX_ATTEMPTS = 3;

  constructor(
    private readonly pollingConfigRepo: IPollingConfigurationRepository,
    private readonly deviceRepo: IDeviceRepository,
    private readonly eligibility: IDeviceEligibilityService,
    private readonly probe: PingCycleProbe,
    private readonly ingestPingResults: IngestPingResultsUseCase,
    logger: ILogger,
    private readonly probeHealth: IProbeHealthReporter = NullProbeHealthReporter,
    private readonly serverOnSite = true,
    private readonly agentProbe: IAgentPingProbe = NoAgentPingProbe
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

    // Asked of the device itself rather than of the polling config's `enabled`
    // flag, which only reflects what an event handler managed to write. Same
    // shape as that guard: forceExecution does not override it — a deleted or
    // retired unit is not something a manual poll should reach either — but it
    // does turn the silent skip into an answer the caller can read.
    const eligibility = await this.checkEligibility(deviceId);
    if (eligibility.isFailure) {
      return this.fail(eligibility.error);
    }
    const { reason: ineligibleReason, agentId } = eligibility.value;
    if (ineligibleReason !== null) {
      if (forceExecution) {
        return this.fail(
          `Cannot poll device ${deviceId} — ${ineligibleReason}`
        );
      }
      return this.ok(
        PollingMapper.toSkippedResultDTO(deviceId.toString(), now)
      );
    }
    // MON-022: the agent polls the device on its own schedule; only a manual
    // poll asks it for one more reading.
    if (agentId !== null && !forceExecution) {
      return this.ok(
        PollingMapper.toSkippedResultDTO(deviceId.toString(), now)
      );
    }

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

    // Monitoring off means nobody is tracking this device, and forceExecution
    // does not override that: a manual poll would write a real reading over the
    // UNKNOWN state with nothing scheduled to ever correct it again. The
    // scheduler never asks for a disabled device, so the skip below is
    // defensive; the failure is the one a caller actually sees.
    if (!config.enabled) {
      if (forceExecution) {
        return this.fail(
          `Monitoring is disabled for device ${deviceId} — enable monitoring before polling it`
        );
      }
      return this.ok(
        PollingMapper.toSkippedResultDTO(deviceId.toString(), now)
      );
    }

    if (!config.ipAddress) {
      return this.fail(
        `Device ${deviceId} has no IP address configured for polling`
      );
    }

    // A manual poll is capped: an operator is waiting on the answer, and with
    // a large threshold the full budget outlasts the HTTP proxy in front.
    const maxAttempts = forceExecution
      ? Math.min(
          config.failuresBeforeDown.value,
          ExecutePollingCycleUseCase.MANUAL_POLL_MAX_ATTEMPTS
        )
      : config.failuresBeforeDown.value;

    let outcome: PingCycleOutcome;
    let measuredAt = now;
    if (agentId !== null) {
      const answer = await this.agentProbe.ping(
        agentId,
        config.ipAddress.value,
        maxAttempts
      );
      if (answer.kind === 'refused') {
        const reason = AGENT_POLL_FAILURES[answer.reason];
        return this.fail(
          `Cannot poll device ${deviceId} — ${
            answer.reason === 'AGENT_ERROR'
              ? `${reason}: ${answer.error}`
              : reason
          }`
        );
      }
      outcome = answer.outcome;
      measuredAt = answer.measuredAt;
    } else {
      outcome = await this.probe.run(
        config.ipAddress.value,
        maxAttempts
      );
      // Only this server's own ping program: an agent's is its own affair.
      if (outcome.kind === 'probe-unavailable') {
        this.probeHealth.recordProbeExecutionFailure(
          deviceId.toString(),
          outcome.error
        );
      } else {
        this.probeHealth.recordProbeExecuted(deviceId.toString());
      }
    }

    const ingestResult = await this.ingestPingResults.execute({
      deviceId: deviceId.toString(),
      outcome,
      measuredAt
    });
    if (ingestResult.isFailure) {
      return this.fail(ingestResult.error);
    }
    if (outcome.kind === 'probe-unavailable') {
      return this.fail(
        agentId !== null
          ? `Cannot poll device ${deviceId} — ${AGENT_POLL_FAILURES.AGENT_ERROR}: ${outcome.error}`
          : `Ping execution error: ${outcome.error}`
      );
    }

    const ingested = ingestResult.value;
    if (ingested.status !== 'APPLIED') {
      return this.ok(
        PollingMapper.toSkippedResultDTO(
          deviceId.toString(),
          measuredAt
        )
      );
    }

    return this.ok(
      PollingMapper.toPollResultDTO({
        deviceId: deviceId.toString(),
        isReachable: outcome.isReachable,
        latencyMs: outcome.latencyMs,
        isOnline: ingested.isOnline,
        consecutiveFailures: ingested.consecutiveFailures,
        timestamp: measuredAt
      })
    );
  }

  // The reason the device may not be polled (null when it may), and the agent
  // that polls it, if any.
  private async checkEligibility(
    deviceId: DeviceId
  ): Promise<
    Result<{ reason: string | null; agentId: string | null }>
  > {
    const refused = (reason: string) =>
      Result.ok({ reason, agentId: null });
    const deviceResult = await this.deviceRepo.findById(deviceId);
    if (deviceResult.isFailure) {
      return Result.fail(
        `Failed to load device: ${deviceResult.error}`
      );
    }

    // findById hides soft-deleted rows, so a tombstone arrives as null.
    if (deviceResult.value === null) {
      return refused('the device no longer exists');
    }

    const decision = this.eligibility.canPoll(deviceResult.value);
    if (!decision.eligible) return refused(decision.message);

    // MON-022: one writer per device. Its agent schedules it, so the
    // scheduler skips it; a manual poll asks that agent instead.
    const agentId = deviceResult.value.agentId;
    if (agentId !== null) {
      return Result.ok({ reason: null, agentId: agentId.toString() });
    }
    // MON-023: off site the server pings nothing, not even a device that has
    // no agent — it would time out against the customer's private address.
    if (!this.serverOnSite) return refused(NOT_ON_MONITORED_NETWORK);
    return Result.ok({ reason: null, agentId: null });
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return data;
  }
}
