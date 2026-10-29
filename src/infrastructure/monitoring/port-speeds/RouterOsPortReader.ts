import { RouterOSAPI } from '../routeros/routerOsApi';
import { Result } from 'domain/shared/core';
import type {
  EthernetPortReading,
  IRouterPortReader,
  RouterPortConnection,
  RouterPortsReading,
  SfpReading
} from 'application/device-monitoring/interfaces';
import type { ILogger } from 'application/shared/interfaces';
import { fromRouterOsText } from '../routeros/routerOsText';

type Row = Record<string, string | undefined>;

export interface RouterOsSession {
  write(command: string, params?: string[]): Promise<Row[]>;
  close(): Promise<void>;
}

export type RouterOsConnect = (
  connection: RouterPortConnection,
  timeoutSeconds: number
) => Promise<RouterOsSession>;

const READ_TIMEOUT_MS = 10_000;

// `rate` as RouterOS prints it: 10Mbps, 100Mbps, 1Gbps, 2.5Gbps, 10Gbps…
const RATE = /^(\d+(?:\.\d+)?)\s*([MG])bps$/i;
// a module reading with or without its unit: -6.384, -6.384dBm, 35C
const NUMBER = /^(-?\d+(?:\.\d+)?)/;

// MON-141: one login per read, closed after; nothing on the router changes.
export class RouterOsPortReader implements IRouterPortReader {
  constructor(
    private readonly logger?: ILogger,
    private readonly connect: RouterOsConnect = connectWithRouterOsApi,
    private readonly timeoutMs: number = READ_TIMEOUT_MS
  ) {}

  async read(
    connection: RouterPortConnection
  ): Promise<Result<RouterPortsReading>> {
    let session: RouterOsSession | null = null;
    try {
      session = await this.connect(
        connection,
        Math.ceil(this.timeoutMs / 1000)
      );
      const reading = await withTimeout(
        readPorts(session),
        this.timeoutMs
      );
      return Result.ok(reading);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger?.warn('[RouterOsPortReader] read failed', {
        host: connection.host,
        error: message
      });
      return Result.fail(`RouterOS API error: ${message}`);
    } finally {
      await session?.close().catch(() => undefined);
    }
  }
}

async function readPorts(
  session: RouterOsSession
): Promise<RouterPortsReading> {
  const [identity] = await session.write('/system/identity/print');
  const ethernet = (
    await session.write('/interface/ethernet/print', [
      '?disabled=false',
      '=.proplist=name,comment'
    ])
  ).filter((r) => r.name);

  const names = ethernet.map((r) => r.name!);
  const monitor = await monitorPorts(session, names);
  // MON-190: a router that refuses either read still has its speeds shown
  const stats = await rowsByName(
    session,
    '/interface/ethernet/print',
    ['=stats=', '=.proplist=name,rx-fcs-error,rx-align-error']
  );
  const interfaces = await rowsByName(session, '/interface/print', [
    '=.proplist=name,link-downs'
  ]);

  const ports = ethernet.map((r): EthernetPortReading => {
    const live = monitor.get(r.name!) ?? {};
    return {
      name: r.name!,
      comment: fromRouterOsText(r.comment ?? '').trim() || null,
      linked: live.status === 'link-ok',
      rateMbps: parseRate(live.rate),
      fullDuplex: parseFlag(live['full-duplex']),
      rxErrors: rxErrors(stats.get(r.name!)),
      linkDowns: parseCount(interfaces.get(r.name!)?.['link-downs']),
      sfp: parseSfp(live)
    };
  });
  return { identity: identity?.name ?? null, ports };
}

async function rowsByName(
  session: RouterOsSession,
  command: string,
  params: string[]
): Promise<Map<string, Row>> {
  try {
    const rows = await session.write(command, params);
    return new Map(
      rows.filter((r) => r.name).map((r) => [r.name!, r] as const)
    );
  } catch {
    return new Map();
  }
}

// FCS and alignment errors: what a bad cable or connector shows. A switch
// chip that counts neither gives null.
function rxErrors(row: Row | undefined): number | null {
  const fcs = errorCount(row?.['rx-fcs-error']);
  const align = errorCount(row?.['rx-align-error']);
  if (fcs === null && align === null) return null;
  return (fcs ?? 0) + (align ?? 0);
}

// An RB5009 on RouterOS 7.23.5 was seen answering 4294967298 for 2 errors:
// a stray bit above the switch chip's 32-bit counter. Billions of errors on
// a port that still links are not real, so only the low 32 bits count.
const ERROR_COUNTER_SPAN = 2 ** 32;

function errorCount(raw: string | undefined): number | null {
  const count = parseCount(raw);
  return count === null ? null : count % ERROR_COUNTER_SPAN;
}

export function parseSfp(row: Row): SfpReading | null {
  const sfp: SfpReading = {
    rxPowerDbm: parseNumber(row['sfp-rx-power']),
    txPowerDbm: parseNumber(row['sfp-tx-power']),
    temperatureC: parseNumber(row['sfp-temperature'])
  };
  const said = Object.values(sfp).some((v) => v !== null);
  return said || parseFlag(row['sfp-module-present']) ? sfp : null;
}

function parseCount(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

function parseNumber(raw: string | undefined): number | null {
  const match = raw ? NUMBER.exec(raw.trim()) : null;
  return match ? Number(match[1]) : null;
}

// All ports in one call; if the router refuses that (a port without a
// monitor in the list), each port on its own so the others still show.
async function monitorPorts(
  session: RouterOsSession,
  names: string[]
): Promise<Map<string, Row>> {
  if (names.length === 0) return new Map();
  const monitorOf = async (list: string[]) => {
    const rows = await session.write('/interface/ethernet/monitor', [
      `=numbers=${list.join(',')}`,
      '=once='
    ]);
    return rows.map((row, i) => [row.name ?? list[i]!, row] as const);
  };

  try {
    return new Map(await monitorOf(names));
  } catch {
    const each = await Promise.all(
      names.map((name) => monitorOf([name]).catch(() => []))
    );
    return new Map(each.flat());
  }
}

// The API answers `true`/`false`; the terminal prints `yes`/`no`.
function parseFlag(raw: string | undefined): boolean | null {
  if (raw === 'true' || raw === 'yes') return true;
  if (raw === 'false' || raw === 'no') return false;
  return null;
}

export function parseRate(raw: string | undefined): number | null {
  const match = raw ? RATE.exec(raw.trim()) : null;
  if (!match) return null;
  const value = Number(match[1]);
  return match[2]!.toUpperCase() === 'G'
    ? Math.round(value * 1000)
    : value;
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`no answer within ${ms} ms`)),
      ms
    );
  });
  return Promise.race([work, timeout]).finally(() =>
    clearTimeout(timer)
  );
}

async function connectWithRouterOsApi(
  connection: RouterPortConnection,
  timeoutSeconds: number
): Promise<RouterOsSession> {
  const client = new RouterOSAPI({
    host: connection.host,
    port: connection.login.apiPort,
    user: connection.login.username,
    password: connection.login.password,
    timeout: timeoutSeconds
  });
  // a socket dropped after login is emitted as 'error'; unheard, it would
  // take the whole process down
  client.on('error', () => undefined);
  await client.connect();
  return {
    write: async (command, params) =>
      (await client.write(command, params ?? [])) as Row[],
    close: async () => {
      if (client.connected) await client.close();
    }
  };
}
