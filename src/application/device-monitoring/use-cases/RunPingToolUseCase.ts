import { Result } from 'domain/shared/core';
import { IPAddress } from 'domain/shared/value-objects';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IAgentPingProbe,
  IPingService,
  IPingToolAgentQuery,
  PingToolAgent
} from '../interfaces';
import {
  PingToolReplyDTO,
  PingToolSummaryDTO,
  RunPingToolDTO
} from '../dtos';

// Shared with the controller, which maps each to its status code.
export const PING_TOOL_AGENT_NOT_FOUND = 'Agent not found';
export const PING_TOOL_NEEDS_AGENT =
  "This server is not on the ISP's network: choose an agent to ping from";
export const PING_TOOL_BUSY =
  'Too many pings are running, try again in a moment';

export interface PingToolOptions {
  defaultCount: number;
  maxCount: number;
  intervalMs: number;
  // the server's own wait for each reply; an agent waits its own 5 s
  timeoutMs: number;
  maxRunning: number;
}

export const DEFAULT_PING_TOOL_OPTIONS: PingToolOptions = {
  defaultCount: 4,
  maxCount: 100,
  intervalMs: 1_000,
  timeoutMs: 2_000,
  maxRunning: 10
};

type PingOnce = Omit<PingToolReplyDTO, 'seq' | 'at'> & {
  // the agent cannot answer at all, so the rest would fail the same way
  fatal?: boolean;
};

// MON-120: pings any address now, from this server or from an agent, one
// ping a second, like a terminal. Nothing is written.
export class RunPingToolUseCase extends UseCase<
  RunPingToolDTO,
  PingToolSummaryDTO
> {
  private running = 0;

  constructor(
    private readonly pingService: IPingService,
    private readonly agentProbe: IAgentPingProbe,
    private readonly agents: IPingToolAgentQuery,
    logger: ILogger,
    private readonly serverOnSite = true,
    private readonly options: PingToolOptions = DEFAULT_PING_TOOL_OPTIONS
  ) {
    super(logger, 'RunPingToolUseCase');
  }

  protected async executeImpl(
    request: RunPingToolDTO
  ): Promise<Result<PingToolSummaryDTO>> {
    const ip = IPAddress.create(request.ipAddress ?? '');
    if (ip.isFailure) return this.fail(ip.error!);
    const count = request.count ?? this.options.defaultCount;
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > this.options.maxCount
    ) {
      return this.fail(
        `count must be between 1 and ${this.options.maxCount}`
      );
    }

    let agent: PingToolAgent | null = null;
    if (request.agentId) {
      const found = await this.agents.findActive(request.agentId);
      if (found.isFailure) {
        return this.fail(`Failed to load the agent: ${found.error}`);
      }
      if (!found.value) return this.fail(PING_TOOL_AGENT_NOT_FOUND);
      agent = found.value;
    } else if (!this.serverOnSite) {
      return this.fail(PING_TOOL_NEEDS_AGENT);
    }

    // MON-122: checked and counted with no await in between.
    if (this.running >= this.options.maxRunning) {
      return this.fail(PING_TOOL_BUSY);
    }
    this.running++;
    try {
      return this.ok(
        await this.run(ip.value.value, count, agent, request)
      );
    } finally {
      this.running--;
    }
  }

  private async run(
    ipAddress: string,
    count: number,
    agent: PingToolAgent | null,
    request: RunPingToolDTO
  ): Promise<PingToolSummaryDTO> {
    const { onStart, onReply, signal } = request;
    const startedAt = new Date();
    onStart({
      ipAddress,
      source: agent ? 'AGENT' : 'SERVER',
      agentId: agent?.id ?? null,
      agentName: agent?.name ?? null,
      count,
      startedAt: startedAt.toISOString()
    });

    const latencies: number[] = [];
    let sent = 0;
    let errors = 0;
    let stoppedEarly: string | null = null;
    for (let seq = 1; seq <= count && !signal?.aborted; seq++) {
      const sentAt = Date.now();
      const reply = await this.pingOnce(ipAddress, agent);
      if (signal?.aborted) break;

      if (reply.outcome === 'ERROR') errors++;
      else sent++;
      if (reply.outcome === 'REPLY' && reply.latencyMs !== null) {
        latencies.push(reply.latencyMs);
      }
      onReply({
        seq,
        outcome: reply.outcome,
        latencyMs: reply.latencyMs,
        detail: reply.detail,
        at: new Date().toISOString()
      });
      if (reply.fatal) {
        stoppedEarly = reply.detail;
        break;
      }
      if (seq < count) {
        await pause(
          this.options.intervalMs - (Date.now() - sentAt),
          signal
        );
      }
    }

    const received = latencies.length;
    return {
      ipAddress,
      sent,
      received,
      errors,
      lossPercent:
        sent === 0 ? null : round(((sent - received) / sent) * 100),
      minMs: received ? Math.min(...latencies) : null,
      avgMs: received
        ? round(latencies.reduce((a, b) => a + b, 0) / received)
        : null,
      maxMs: received ? Math.max(...latencies) : null,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      stoppedEarly,
      cancelled: signal?.aborted ?? false
    };
  }

  private async pingOnce(
    ipAddress: string,
    agent: PingToolAgent | null
  ): Promise<PingOnce> {
    try {
      return agent
        ? await this.pingFromAgent(ipAddress, agent.id)
        : await this.pingFromServer(ipAddress);
    } catch (error) {
      return {
        outcome: 'ERROR',
        latencyMs: null,
        detail: `Ping could not run: ${
          error instanceof Error ? error.message : String(error)
        }`
      };
    }
  }

  private async pingFromServer(ipAddress: string): Promise<PingOnce> {
    const result = await this.pingService.ping(
      ipAddress,
      this.options.timeoutMs
    );
    if (result.isFailure) {
      return {
        outcome: 'ERROR',
        latencyMs: null,
        detail: `Ping could not run: ${result.error}`
      };
    }
    return result.value.isReachable
      ? {
          outcome: 'REPLY',
          latencyMs: result.value.latencyMs,
          detail: null
        }
      : { outcome: 'NO_REPLY', latencyMs: null, detail: null };
  }

  // MON-121: one attempt per request, so each line is one ping.
  private async pingFromAgent(
    ipAddress: string,
    agentId: string
  ): Promise<PingOnce> {
    const answer = await this.agentProbe.ping(agentId, ipAddress, 1);
    if (answer.kind === 'refused') {
      return {
        outcome: 'ERROR',
        latencyMs: null,
        detail: answer.error,
        fatal:
          answer.reason === 'AGENT_OFFLINE' ||
          answer.reason === 'PROBE_UNSUPPORTED'
      };
    }
    const { outcome } = answer;
    if (outcome.kind === 'probe-unavailable') {
      return {
        outcome: 'ERROR',
        latencyMs: null,
        detail: `Ping could not run on the agent: ${outcome.error}`
      };
    }
    return outcome.isReachable
      ? {
          outcome: 'REPLY',
          latencyMs: outcome.latencyMs,
          detail: null
        }
      : { outcome: 'NO_REPLY', latencyMs: null, detail: null };
  }
}

function pause(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0 || signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
