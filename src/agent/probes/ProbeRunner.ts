import type { ILogger } from 'application/shared/interfaces';
import type { PingCycleOutcome } from 'application/device-monitoring/services/PingCycleProbe';
import type {
  IRadioHostnameWriterResolver,
  IWirelessCollectorResolver,
  WirelessCollectionResult
} from 'application/wireless-monitoring/interfaces';
import type { IConfigFetcherResolver } from 'application/device-backups/interfaces';
import type {
  IRouterOsPrinter,
  IRouterPortReader,
  IRouterTrafficReader
} from 'application/device-monitoring/interfaces';
import { Result } from 'domain/shared/core';
import { expandCidr } from 'infrastructure/monitoring/network-scanner/utils/expandCidr';
import {
  DiscoveredHostWire,
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

export interface ArpTable {
  read(): Promise<Map<string, string>>;
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

const NO_ARP_TABLE: ArpTable = { read: async () => new Map() };

const NO_PORT_READER: IRouterPortReader = {
  read: async () =>
    Result.fail('Reading ports is not supported by this agent')
};

const NO_ROUTEROS_PRINTER: IRouterOsPrinter = {
  print: async () =>
    Result.fail('Reading routers is not supported by this agent')
};

// Addresses a discover request pings at once (AGT-121): a /24 answers in
// about four rounds of the sweep's one-second wait.
const DISCOVER_BATCH = 64;

// Answers the backend's probe requests (AGT-101) with the same ping loop,
// wireless collectors, config fetchers (AGT-114) and router traffic reader
// (AGT-117) the backend runs in process, and sweeps a batch of addresses
// with the quick ping the backend's own sweep uses (AGT-119), renames a
// radio with the backend's own hostname writers (AGT-120), and scans a
// segment with that same quick ping and the PC's ARP table (AGT-121), and
// reads a router's Ethernet ports with the backend's port reader (AGT-122),
// and runs allowed read-only RouterOS commands with the backend's printer,
// which refuses any other (AGT-123).
// The credentials in a request live only as long as the request (AGT-102,
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
    private readonly hostnames: IRadioHostnameWriterResolver = NO_HOSTNAME_WRITERS,
    private readonly arp: ArpTable = NO_ARP_TABLE,
    private readonly ports: IRouterPortReader = NO_PORT_READER,
    private readonly routerOs: IRouterOsPrinter = NO_ROUTEROS_PRINTER
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

    if (request.kind === 'discover') {
      this.logger.debug('Probe request', {
        kind: request.kind,
        cidr: request.cidr
      });
      return this.discover(request.requestId, request.cidr, at);
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

    if (request.kind === 'ports') {
      const read = await this.ports.read({
        host: request.ip,
        login: request.login,
        agentId: null
      });
      if (read.isFailure) return failed(request, read.error);
      return {
        type: 'probe.result',
        requestId: request.requestId,
        kind: 'ports',
        at,
        identity: read.value.identity,
        ports: read.value.ports
      };
    }

    if (request.kind === 'routeros-print') {
      if (!Array.isArray(request.commands)) {
        return failed(request, 'No commands to run');
      }
      const printed = await this.routerOs.print(
        { host: request.ip, login: request.login, agentId: null },
        request.commands
      );
      if (printed.isFailure) return failed(request, printed.error);
      return {
        type: 'probe.result',
        requestId: request.requestId,
        kind: 'routeros-print',
        at,
        answers: printed.value
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

  private async discover(
    requestId: string,
    cidr: string,
    at: number
  ): Promise<ProbeResultMessage> {
    // Throws past a /22, which run() answers as the request's error.
    const ips = expandCidr(cidr);
    const answered: Array<{ ip: string; latencyMs: number | null }> =
      [];
    for (let i = 0; i < ips.length; i += DISCOVER_BATCH) {
      const batch = ips.slice(i, i + DISCOVER_BATCH);
      const readings = await Promise.all(
        batch.map((ip) => this.sweepOne(ip, 1))
      );
      readings.forEach((reading, j) => {
        if ('reachable' in reading && reading.reachable) {
          answered.push({
            ip: batch[j],
            latencyMs: reading.latencyMs
          });
        }
      });
    }
    const table = await this.readArpTable();
    const hosts: DiscoveredHostWire[] = answered.map((host) => ({
      ip: host.ip,
      mac: table.get(host.ip) ?? null,
      latencyMs: host.latencyMs
    }));
    return {
      type: 'probe.result',
      requestId,
      kind: 'discover',
      at,
      hosts
    };
  }

  // Without the table the hosts still answer, only with no MAC.
  private async readArpTable(): Promise<Map<string, string>> {
    try {
      return await this.arp.read();
    } catch (error) {
      this.logger.warn('Could not read the ARP table', {
        error: error instanceof Error ? error.message : String(error)
      });
      return new Map();
    }
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
