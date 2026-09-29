import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { IDeviceEligibilityService } from 'domain/device-inventory/services';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IProbeHealthReporter,
  NullProbeHealthReporter
} from '../interfaces';
import { PollingMapper } from '../mappers';
import { PingCycleProbe } from '../services';
import {
  ExecutePollingCycleDTO,
  SingleDevicePollingResultDTO
} from '../dtos';
import { IngestPingResultsUseCase } from './IngestPingResultsUseCase';

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

    // Asked of the device itself rather than of the polling config's `enabled`
    // flag, which only reflects what an event handler managed to write. Same
    // shape as that guard: forceExecution does not override it — a deleted or
    // retired unit is not something a manual poll should reach either — but it
    // does turn the silent skip into an answer the caller can read.
    const ineligibleReason =
      await this.findIneligibilityReason(deviceId);
    if (ineligibleReason.isFailure) {
      return this.fail(ineligibleReason.error);
    }
    if (ineligibleReason.value !== null) {
      if (forceExecution) {
        return this.fail(
          `Cannot poll device ${deviceId} — ${ineligibleReason.value}`
        );
      }
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

    const outcome = await this.probe.run(
      config.ipAddress.value,
      maxAttempts
    );
    if (outcome.kind === 'probe-unavailable') {
      this.probeHealth.recordProbeExecutionFailure(
        deviceId.toString(),
        outcome.error
      );
    } else {
      this.probeHealth.recordProbeExecuted(deviceId.toString());
    }

    const ingestResult = await this.ingestPingResults.execute({
      deviceId: deviceId.toString(),
      outcome,
      measuredAt: now
    });
    if (ingestResult.isFailure) {
      return this.fail(ingestResult.error);
    }
    if (outcome.kind === 'probe-unavailable') {
      return this.fail(`Ping execution error: ${outcome.error}`);
    }

    const ingested = ingestResult.value;
    if (ingested.status !== 'APPLIED') {
      return this.ok(
        PollingMapper.toSkippedResultDTO(deviceId.toString(), now)
      );
    }

    return this.ok(
      PollingMapper.toPollResultDTO({
        deviceId: deviceId.toString(),
        isReachable: outcome.isReachable,
        latencyMs: outcome.latencyMs,
        isOnline: ingested.isOnline,
        consecutiveFailures: ingested.consecutiveFailures,
        timestamp: now
      })
    );
  }

  // Returns null when the device may be polled, or the reason it may not.
  private async findIneligibilityReason(
    deviceId: DeviceId
  ): Promise<Result<string | null>> {
    const deviceResult = await this.deviceRepo.findById(deviceId);
    if (deviceResult.isFailure) {
      return Result.fail(
        `Failed to load device: ${deviceResult.error}`
      );
    }

    // findById hides soft-deleted rows, so a tombstone arrives as null.
    if (deviceResult.value === null) {
      return Result.ok('the device no longer exists');
    }

    const decision = this.eligibility.canPoll(deviceResult.value);
    if (!decision.eligible) return Result.ok(decision.message);

    // MON-022: one writer per device. On-demand polls through an agent
    // arrive with ADR 0002 phase 4.
    if (deviceResult.value.agentId !== null) {
      return Result.ok(
        'it is polled by an on-site agent, and polling it on demand is not available yet'
      );
    }
    return Result.ok(null);
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return data;
  }
}
