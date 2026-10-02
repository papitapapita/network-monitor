import type { ILogger } from 'application/shared/interfaces';
import type { PingCycleOutcome } from 'application/device-monitoring/services/PingCycleProbe';
import type {
  IWirelessCollectorResolver,
  WirelessCollectionResult
} from 'application/wireless-monitoring/interfaces';
import {
  PingReadingWire,
  ProbeRequestMessage,
  ProbeResultMessage,
  WirelessReadingWire
} from 'agent/protocol';

export interface PingProbe {
  run(
    ipAddress: string,
    maxAttempts: number
  ): Promise<PingCycleOutcome>;
}

export interface ProbeRunnerOptions {
  maxConcurrent: number;
  // Requests waiting beyond these are answered "busy" at once rather than
  // left to time out on the backend.
  maxQueued: number;
}

export const DEFAULT_PROBE_RUNNER_OPTIONS: ProbeRunnerOptions = {
  maxConcurrent: 4,
  maxQueued: 100
};

const MAX_PING_ATTEMPTS = 10;

// Answers the backend's probe requests (AGT-101) with the same ping loop and
// wireless collectors the backend runs in process. The credentials in a
// request live only as long as the request (AGT-102): nothing here stores
// or logs them.
export class ProbeRunner {
  private running = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(
    private readonly ping: PingProbe,
    private readonly collectors: IWirelessCollectorResolver,
    private readonly logger: ILogger,
    private readonly options: ProbeRunnerOptions = DEFAULT_PROBE_RUNNER_OPTIONS
  ) {}

  async run(
    request: ProbeRequestMessage
  ): Promise<ProbeResultMessage> {
    if (
      this.running >= this.options.maxConcurrent &&
      this.waiting.length >= this.options.maxQueued
    ) {
      return failed(request, 'The agent is busy with other probes');
    }
    await this.acquire();
    try {
      return await this.measure(request);
    } catch (error) {
      return failed(
        request,
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      this.release();
    }
  }

  private async measure(
    request: ProbeRequestMessage
  ): Promise<ProbeResultMessage> {
    const at = Date.now();
    this.logger.debug('Probe request', {
      kind: request.kind,
      ip: request.ip
    });

    if (request.kind === 'ping') {
      const attempts = Math.min(
        Math.max(Math.trunc(request.attempts) || 1, 1),
        MAX_PING_ATTEMPTS
      );
      const outcome = await this.ping.run(request.ip, attempts);
      return {
        type: 'probe.result',
        requestId: request.requestId,
        kind: 'ping',
        at,
        reading: toPingReadingWire(outcome)
      };
    }

    if (request.kind !== 'wireless') {
      return failed(request, 'Unknown probe kind');
    }
    const collector = this.collectors.forVendor(request.vendor);
    if (!collector) {
      return failed(
        request,
        `Wireless polling is not supported for vendor '${request.vendor}'`
      );
    }
    const collected = await collector.collect(
      request.ip,
      request.credentials,
      request.deviceType
    );
    if (collected.isFailure) return failed(request, collected.error);
    return {
      type: 'probe.result',
      requestId: request.requestId,
      kind: 'wireless',
      at,
      reading: toWirelessReadingWire(collected.value)
    };
  }

  private acquire(): Promise<void> {
    if (this.running < this.options.maxConcurrent) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise((resolve) =>
      this.waiting.push(() => {
        this.running++;
        resolve();
      })
    );
  }

  private release(): void {
    this.running--;
    this.waiting.shift()?.();
  }
}

function failed(
  request: { requestId: string },
  error: string
): ProbeResultMessage {
  return {
    type: 'probe.result',
    requestId: request.requestId,
    error: error.slice(0, 500)
  };
}

function toPingReadingWire(
  outcome: PingCycleOutcome
): PingReadingWire {
  return outcome.kind === 'measured'
    ? {
        reachable: outcome.isReachable,
        latencyMs: outcome.latencyMs,
        attempts: outcome.attempts
      }
    : { probeError: outcome.error, attempts: outcome.attempts };
}

const counter = (value: bigint | null): string | null =>
  value === null ? null : value.toString();

export function toWirelessReadingWire(
  reading: WirelessCollectionResult
): WirelessReadingWire {
  return {
    ...reading,
    wirelessTxBytes: counter(reading.wirelessTxBytes),
    wirelessRxBytes: counter(reading.wirelessRxBytes),
    clients: reading.clients.map((client) => ({
      ...client,
      txBytesTotal: counter(client.txBytesTotal),
      rxBytesTotal: counter(client.rxBytesTotal)
    }))
  };
}
