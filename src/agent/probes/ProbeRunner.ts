import type { ILogger } from 'application/shared/interfaces';
import type { PingCycleOutcome } from 'application/device-monitoring/services/PingCycleProbe';
import type {
  IRadioHostnameWriterResolver,
  IWirelessCollectorResolver,
  WirelessCollectionResult
} from 'application/wireless-monitoring/interfaces';
import type { IConfigFetcherResolver } from 'application/device-backups/interfaces';
import type { IRouterTrafficReader } from 'application/device-monitoring/interfaces';
import {
  MAX_SWEEP_TARGETS,
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

const NO_HOSTNAME_WRITERS: IRadioHostnameWriterResolver = {
  forVendor: () => null
};

// Answers the backend's probe requests (AGT-101) with the same ping loop,
// wireless collectors, config fetchers (AGT-114) and router traffic reader
// (AGT-117) the backend runs in process, and sweeps a batch of addresses
// with the quick ping the backend's own sweep uses (AGT-119), and renames a
// radio with the backend's own hostname writers (AGT-120). The
// credentials in a request live only as long as the request (AGT-102,
// AGT-115), except a router login, which the traffic reader holds open
// between reads (AGT-118): nothing here stores or logs them.
export class ProbeRunner {
  private running = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(
    private readonly ping: PingProbe,
    private readonly collectors: IWirelessCollectorResolver,
    private readonly fetchers: IConfigFetcherResolver,
    private readonly traffic: IRouterTrafficReader,
    private readonly logger: ILogger,
    private readonly options: ProbeRunnerOptions = DEFAULT_PROBE_RUNNER_OPTIONS,
    // MON-082: a short reply wait and no pause between attempts.
    private readonly sweepPing: PingProbe = ping,
    private readonly hostnames: IRadioHostnameWriterResolver = NO_HOSTNAME_WRITERS
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

    if (request.kind === 'sweep') {
      this.logger.debug('Probe request', {
        kind: request.kind,
        targets: request.ips.length
      });
      if (request.ips.length > MAX_SWEEP_TARGETS) {
        return failed(
          request,
          `A sweep names at most ${MAX_SWEEP_TARGETS} addresses`
        );
      }
      const attempts = clampAttempts(request.attempts);
      const readings = await Promise.all(
        request.ips.map((ip) => this.sweepOne(ip, attempts))
      );
      return {
        type: 'probe.result',
        requestId: request.requestId,
        kind: 'sweep',
        at,
        readings
      };
    }

    this.logger.debug('Probe request', {
      kind: request.kind,
      ip: request.ip
    });

    if (request.kind === 'ping') {
      const attempts = clampAttempts(request.attempts);
      const outcome = await this.ping.run(request.ip, attempts);
      return {
        type: 'probe.result',
        requestId: request.requestId,
        kind: 'ping',
        at,
        reading: toPingReadingWire(outcome)
      };
    }

    if (request.kind === 'backup') {
      const fetcher = this.fetchers.forDevice(
        request.vendor,
        request.deviceKind
      );
      if (!fetcher) {
        return failed(
          request,
          'Backups are not supported for this kind of device from this vendor yet'
        );
      }
      const fetched = await fetcher.fetch(request.ip, request.login);
      if (fetched.isFailure) return failed(request, fetched.error);
      return {
        type: 'probe.result',
        requestId: request.requestId,
        kind: 'backup',
        at,
        config: fetched.value
      };
    }

    if (request.kind === 'hostname') {
      const writer = this.hostnames.forVendor(request.vendor);
      if (!writer) {
        return failed(
          request,
          `Renaming radios is not supported for vendor '${request.vendor}'`
        );
      }
      const written = await writer.setHostname(
        request.ip,
        request.login,
        request.hostname
      );
      if (written.isFailure) return failed(request, written.error);
      return {
        type: 'probe.result',
        requestId: request.requestId,
        kind: 'hostname',
        at
      };
    }

    if (request.kind === 'traffic') {
      const read = await this.traffic.read({
        host: request.ip,
        port: request.login.apiPort,
        username: request.login.username,
        password: request.login.password,
        agentId: null
      });
      if (read.isFailure) return failed(request, read.error);
      return {
        type: 'probe.result',
        requestId: request.requestId,
        kind: 'traffic',
        at,
        interfaces: read.value
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

  // One address that cannot be pinged must not fail the whole batch.
  private async sweepOne(
    ip: string,
    attempts: number
  ): Promise<PingReadingWire> {
    try {
      return toPingReadingWire(
        await this.sweepPing.run(ip, attempts)
      );
    } catch (error) {
      return {
        probeError: (error instanceof Error
          ? error.message
          : String(error)
        ).slice(0, 500),
        attempts: 1
      };
    }
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

function clampAttempts(attempts: number): number {
  return Math.min(
    Math.max(Math.trunc(attempts) || 1, 1),
    MAX_PING_ATTEMPTS
  );
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
