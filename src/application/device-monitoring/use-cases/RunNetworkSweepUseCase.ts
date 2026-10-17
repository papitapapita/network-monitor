import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  AgentSweepAnswer,
  IAgentSweepProbe,
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
  // MON-084: addresses per request to an agent, and requests out at once
  // per agent; together the agent's share of pings in flight.
  agentBatchSize: number;
  agentBatchesInFlight: number;
}

export const DEFAULT_NETWORK_SWEEP_OPTIONS: NetworkSweepOptions = {
  concurrency: 64,
  attempts: 3,
  agentBatchSize: 32,
  agentBatchesInFlight: 2
};

// MON-080: pings every in-service device once, now, from this server or
// from the agent it sits behind, and reports what answered. A snapshot only: nothing is written and nothing is alerted.
export class RunNetworkSweepUseCase extends UseCase<
  RunNetworkSweepDTO,
  NetworkSweepSummaryDTO
> {
  private running = false;

  constructor(
    private readonly targets: INetworkSweepTargetsQuery,
    // MON-082: built with a short reply wait and no pause between attempts.
    private readonly probe: PingCycleProbe,
    // MON-084: devices behind an on-site agent are pinged by it.
    private readonly agentProbe: IAgentSweepProbe,
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
    await Promise.all([
      this.pingAll(
        toPing.filter((c) => c.agentId === null),
        emit,
        signal
      ),
      this.sweepThroughAgents(
        toPing.filter((c) => c.agentId !== null),
        emit,
        signal
      )
    ]);

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

  // A device behind an agent is pinged by it wherever this server runs
  // (MON-022, MON-023).
  private skipReason(
    candidate: NetworkSweepCandidate
  ): NetworkSweepSkipReason | null {
    if (!candidate.monitored) return 'MONITORING_DISABLED';
    if (!candidate.ipAddress) return 'NO_IP_ADDRESS';
    if (candidate.agentId !== null) return null;
    if (!this.serverOnSite) return 'NOT_ON_MONITORED_NETWORK';
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

  // MON-084: every agent at once, each sent its devices in batches, a couple
  // out at a time; the same cancellation as pingAll.
  private async sweepThroughAgents(
    targets: NetworkSweepCandidate[],
    emit: (result: NetworkSweepResultDTO) => void,
    signal: AbortSignal | undefined
  ): Promise<void> {
    const byAgent = new Map<string, NetworkSweepCandidate[]>();
    for (const target of targets) {
      const devices = byAgent.get(target.agentId!) ?? [];
      devices.push(target);
      byAgent.set(target.agentId!, devices);
    }
    await Promise.all(
      [...byAgent].map(([agentId, devices]) =>
        this.sweepAgent(agentId, devices, emit, signal)
      )
    );
  }

  private async sweepAgent(
    agentId: string,
    devices: NetworkSweepCandidate[],
    emit: (result: NetworkSweepResultDTO) => void,
    signal: AbortSignal | undefined
  ): Promise<void> {
    const size = this.options.agentBatchSize;
    const batches = Array.from(
      { length: Math.ceil(devices.length / size) },
      (_, i) => devices.slice(i * size, (i + 1) * size)
    );
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < batches.length && !signal?.aborted) {
        const batch = batches[next++];
        const answer = await this.askAgent(
          agentId,
          batch.map((device) => device.ipAddress!)
        );
        if (signal?.aborted) return;
        const at = new Date();
        batch.forEach((device, i) =>
          emit(
            toResult(
              device,
              answer.kind === 'measured'
                ? fromOutcome(answer.outcomes[i], at)
                : { outcome: 'ERROR', detail: answer.error, at }
            )
          )
        );
      }
    };
    const workers = Math.min(
      this.options.agentBatchesInFlight,
      batches.length
    );
    await Promise.all(Array.from({ length: workers }, worker));
  }

  private async askAgent(
    agentId: string,
    ipAddresses: string[]
  ): Promise<AgentSweepAnswer> {
    try {
      return await this.agentProbe.sweep(
        agentId,
        ipAddresses,
        this.options.attempts
      );
    } catch (error) {
      return {
        kind: 'refused',
        reason: 'AGENT_ERROR',
        error: error instanceof Error ? error.message : String(error)
      };
    }
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

function fromOutcome(
  outcome: PingCycleOutcome,
  at = new Date()
): SweepReading {
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
    agentName: candidate.agentName,
    outcome: reading.outcome,
    latencyMs: reading.latencyMs ?? null,
    attempts: reading.attempts ?? 0,
    reason: reading.reason ?? null,
    detail: reading.detail ?? null,
    at: reading.at.toISOString()
  };
}
