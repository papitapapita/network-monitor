import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  INetworkSweepTargetsQuery,
  NetworkSweepCandidate
} from '../interfaces';
import { PingCycleOutcome, PingCycleProbe } from '../services';
import {
  NetworkSweepResultDTO,
  NetworkSweepSkipReason,
  NetworkSweepSummaryDTO,
  RunNetworkSweepDTO
} from '../dtos';

// Shared with the controller, which answers 409 when a failure carries it.
export const NETWORK_SWEEP_RUNNING =
  'A network sweep is already running';

export const NETWORK_SWEEP_SKIP_DETAILS: Record<
  NetworkSweepSkipReason,
  string
> = {
  MONITORING_DISABLED: 'Monitoring is disabled for this device',
  BEHIND_AGENT: 'Devices behind an on-site agent are not swept yet',
  NOT_ON_MONITORED_NETWORK:
    'This server is not on the monitored network',
  NO_IP_ADDRESS: 'The device has no IP address configured for polling'
};

// MON-082: the backbone answers "is it the whole network or one link?", so
// it is asked first.
const CATEGORY_ORDER: Record<string, number> = {
  GATEWAY: 0,
  AGGREGATION_SWITCH: 1,
  ACCESS_POINT: 2
};

export interface NetworkSweepOptions {
  concurrency: number;
  attempts: number;
}

export const DEFAULT_NETWORK_SWEEP_OPTIONS: NetworkSweepOptions = {
  concurrency: 64,
  attempts: 3
};

// MON-080: pings every in-service device once, now, and reports what
// answered. A snapshot only: nothing is written and nothing is alerted.
export class RunNetworkSweepUseCase extends UseCase<
  RunNetworkSweepDTO,
  NetworkSweepSummaryDTO
> {
  private running = false;

  constructor(
    private readonly targets: INetworkSweepTargetsQuery,
    // MON-082: built with a short reply wait and no pause between attempts.
    private readonly probe: PingCycleProbe,
    logger: ILogger,
    private readonly serverOnSite = true,
    private readonly options: NetworkSweepOptions = DEFAULT_NETWORK_SWEEP_OPTIONS
  ) {
    super(logger, 'RunNetworkSweepUseCase');
  }

  protected async executeImpl(
    request: RunNetworkSweepDTO
  ): Promise<Result<NetworkSweepSummaryDTO>> {
    // MON-083: checked and set before the first await, so two clicks cannot
    // both get through.
    if (this.running) return this.fail(NETWORK_SWEEP_RUNNING);
    this.running = true;
    try {
      return await this.sweep(request);
    } finally {
      this.running = false;
    }
  }

  private async sweep(
    request: RunNetworkSweepDTO
  ): Promise<Result<NetworkSweepSummaryDTO>> {
    const { filters, onStart, onResult, signal } = request;

    const candidatesResult =
      await this.targets.listInService(filters);
    if (candidatesResult.isFailure) {
      return this.fail(
        `Failed to load the devices to sweep: ${candidatesResult.error}`
      );
    }
    const candidates = [...candidatesResult.value].sort(
      backboneFirst
    );

    const startedAt = new Date();
    const toPing: NetworkSweepCandidate[] = [];
    const skipped: NetworkSweepResultDTO[] = [];
    for (const candidate of candidates) {
      const reason = this.skipReason(candidate);
      if (reason === null) {
        toPing.push(candidate);
      } else {
        skipped.push(
          toResult(candidate, {
            outcome: 'SKIPPED',
            reason,
            detail: NETWORK_SWEEP_SKIP_DETAILS[reason],
            at: startedAt
          })
        );
      }
    }

    const counts = { up: 0, down: 0, error: 0, skipped: 0 };
    const emit = (result: NetworkSweepResultDTO): void => {
      if (result.outcome === 'UP') counts.up++;
      else if (result.outcome === 'DOWN') counts.down++;
      else if (result.outcome === 'ERROR') counts.error++;
      else counts.skipped++;
      onResult(result);
    };

    onStart({
      startedAt: startedAt.toISOString(),
      total: candidates.length,
      toPing: toPing.length,
      filters
    });
    skipped.forEach(emit);
    await this.pingAll(toPing, emit, signal);

    const finishedAt = new Date();
    return this.ok({
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      total: candidates.length,
      ...counts,
      cancelled: signal?.aborted ?? false
    });
  }

  // Same order as the scheduler's own guards: off, behind an agent, off site.
  private skipReason(
    candidate: NetworkSweepCandidate
  ): NetworkSweepSkipReason | null {
    if (!candidate.monitored) return 'MONITORING_DISABLED';
    if (candidate.agentId !== null) return 'BEHIND_AGENT';
    if (!this.serverOnSite) return 'NOT_ON_MONITORED_NETWORK';
    if (!candidate.ipAddress) return 'NO_IP_ADDRESS';
    return null;
  }

  // MON-083: once the caller goes away no new ping starts; those already out
  // finish and are dropped.
  private async pingAll(
    targets: NetworkSweepCandidate[],
    emit: (result: NetworkSweepResultDTO) => void,
    signal: AbortSignal | undefined
  ): Promise<void> {
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < targets.length && !signal?.aborted) {
        const target = targets[next++];
        const outcome = await this.ping(target.ipAddress!);
        if (signal?.aborted) return;
        emit(toResult(target, fromOutcome(outcome)));
      }
    };
    const workers = Math.min(
      this.options.concurrency,
      targets.length
    );
    await Promise.all(Array.from({ length: workers }, worker));
  }

  // One device's failure must not end the sweep for the rest.
  private async ping(ipAddress: string): Promise<PingCycleOutcome> {
    try {
      return await this.probe.run(ipAddress, this.options.attempts);
    } catch (error) {
      return {
        kind: 'probe-unavailable',
        error: error instanceof Error ? error.message : String(error),
        attempts: 0
      };
    }
  }

  protected sanitizeForLogging(data: unknown): unknown {
    if (data && typeof data === 'object' && 'filters' in data) {
      return { filters: (data as RunNetworkSweepDTO).filters };
    }
    return data;
  }
}

function backboneFirst(
  a: NetworkSweepCandidate,
  b: NetworkSweepCandidate
): number {
  const rank = (c: NetworkSweepCandidate): number =>
    CATEGORY_ORDER[c.category ?? ''] ??
    Object.keys(CATEGORY_ORDER).length;
  return (
    rank(a) - rank(b) ||
    a.deviceName.localeCompare(b.deviceName) ||
    a.deviceId.localeCompare(b.deviceId)
  );
}

interface SweepReading {
  outcome: NetworkSweepResultDTO['outcome'];
  latencyMs?: number | null;
  attempts?: number;
  reason?: NetworkSweepSkipReason;
  detail?: string;
  at: Date;
}

function fromOutcome(outcome: PingCycleOutcome): SweepReading {
  const at = new Date();
  if (outcome.kind === 'probe-unavailable') {
    return {
      outcome: 'ERROR',
      attempts: outcome.attempts,
      detail: `Ping could not run: ${outcome.error}`,
      at
    };
  }
  return {
    outcome: outcome.isReachable ? 'UP' : 'DOWN',
    latencyMs: outcome.latencyMs,
    attempts: outcome.attempts,
    at
  };
}

function toResult(
  candidate: NetworkSweepCandidate,
  reading: SweepReading
): NetworkSweepResultDTO {
  return {
    deviceId: candidate.deviceId,
    deviceName: candidate.deviceName,
    ipAddress: candidate.ipAddress,
    category: candidate.category,
    locationId: candidate.locationId,
    locationName: candidate.locationName,
    outcome: reading.outcome,
    latencyMs: reading.latencyMs ?? null,
    attempts: reading.attempts ?? 0,
    reason: reading.reason ?? null,
    detail: reading.detail ?? null,
    at: reading.at.toISOString()
  };
}
