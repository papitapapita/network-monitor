import { RouterOSAPI } from 'node-routeros';
import { Result } from 'domain/shared/core';
import type {
  EthernetPortReading,
  IRouterPortReader,
  RouterPortConnection,
  RouterPortsReading
} from 'application/device-monitoring/interfaces';
import type { ILogger } from 'application/shared/interfaces';

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

  const ports = ethernet.map((r): EthernetPortReading => {
    const live = monitor.get(r.name!) ?? {};
    return {
      name: r.name!,
      comment: r.comment?.trim() || null,
      linked: live.status === 'link-ok',
      rateMbps: parseRate(live.rate),
      fullDuplex:
        live['full-duplex'] === undefined
          ? null
          : live['full-duplex'] === 'true'
    };
  });
  return { identity: identity?.name ?? null, ports };
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
