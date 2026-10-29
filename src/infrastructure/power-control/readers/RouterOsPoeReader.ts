import { RouterOSAPI } from '../../monitoring/routeros/routerOsApi';
import { Result } from 'domain/shared/core';
import {
  PoeMode,
  PoePortLabel,
  PoeStatus
} from 'domain/power-control';
import type {
  IPoeSwitchReader,
  PoePortReading,
  PoeSwitchConnection,
  PoeSwitchReading
} from 'application/power-control/interfaces';
import type { ILogger } from 'application/shared/interfaces';
import { parseMeasure, withTimeout } from './readerSupport';

type Row = Record<string, string | undefined>;

export interface RouterOsSession {
  write(command: string, params?: string[]): Promise<Row[]>;
  close(): Promise<void>;
}

export type RouterOsConnect = (
  connection: PoeSwitchConnection,
  timeoutSeconds: number
) => Promise<RouterOsSession>;

const READ_TIMEOUT_MS = 10_000;

const MODES: Record<string, PoeMode> = {
  off: PoeMode.OFF,
  'auto-on': PoeMode.AUTO,
  'forced-on': PoeMode.FORCED_ON
};

const STATUSES: Record<string, PoeStatus> = {
  'powered-on': PoeStatus.POWERED,
  'waiting-for-load': PoeStatus.NO_LOAD,
  disabled: PoeStatus.OFF,
  off: PoeStatus.OFF,
  'short-circuit': PoeStatus.FAULT,
  overload: PoeStatus.FAULT,
  'voltage-too-low': PoeStatus.FAULT,
  'current-too-low': PoeStatus.FAULT
};

// PWR-023: RouterOS v7 keeps the PoE setting under /interface/ethernet/poe;
// some v6 releases keep it on /interface/ethernet itself. Both are tried, so
// the version only needs to be shown, not branched on.
export class RouterOsPoeReader implements IPoeSwitchReader {
  constructor(
    private readonly logger?: ILogger,
    private readonly connect: RouterOsConnect = connectWithRouterOsApi,
    private readonly timeoutMs: number = READ_TIMEOUT_MS
  ) {}

  async read(
    connection: PoeSwitchConnection
  ): Promise<Result<PoeSwitchReading>> {
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
      this.logger?.warn('[RouterOsPoeReader] read failed', {
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
): Promise<PoeSwitchReading> {
  const [resource] = await session.write('/system/resource/print', [
    '=.proplist=version'
  ]);
  const ethernet = await session.write('/interface/ethernet/print', [
    '=.proplist=name,comment,poe-out'
  ]);
  const poeMenu = await session
    .write('/interface/ethernet/poe/print', [
      '=.proplist=name,poe-out'
    ])
    .catch(() => [] as Row[]);

  const settings = (poeMenu.length > 0 ? poeMenu : ethernet).filter(
    (r) => r.name && r['poe-out'] !== undefined
  );
  if (settings.length === 0) {
    return { firmwareVersion: resource?.version ?? null, ports: [] };
  }

  const names = settings.map((r) => r.name!);
  const monitor = await monitorPorts(session, names);
  const comments = new Map(ethernet.map((r) => [r.name, r.comment]));

  const ports = settings.map((r): PoePortReading => {
    const name = r.name!;
    const live = monitor.get(name) ?? {};
    const mode = MODES[r['poe-out']!] ?? PoeMode.UNKNOWN;
    return {
      port: name,
      label: labelOf(name, comments.get(name)),
      mode,
      status: statusOf(mode, live['poe-out-status']),
      powerWatts: powerOf(live),
      voltage: parseMeasure(live['poe-out-voltage'])
    };
  });
  return { firmwareVersion: resource?.version ?? null, ports };
}

// The live readings, from the PoE menu where it has a monitor, else from the
// ethernet monitor. Without either, ports are still listed, status unknown.
async function monitorPorts(
  session: RouterOsSession,
  names: string[]
): Promise<Map<string, Row>> {
  const params = [`=numbers=${names.join(',')}`, '=once='];
  const rows = await session
    .write('/interface/ethernet/poe/monitor', params)
    .catch(() =>
      session
        .write('/interface/ethernet/monitor', params)
        .catch(() => [] as Row[])
    );
  return new Map(
    rows.map((row, i) => [row.name ?? names[i]!, row] as const)
  );
}

// PWR-030: the label is whichever of the comment and the name holds an IP,
// since an operator may have put it in either.
function labelOf(name: string, comment: string | undefined): string {
  const text = comment?.trim() ?? '';
  if (text && PoePortLabel.ipOf(text)) return text;
  if (PoePortLabel.ipOf(name)) return name;
  return text || name;
}

function statusOf(mode: PoeMode, raw: string | undefined): PoeStatus {
  if (raw !== undefined) return STATUSES[raw] ?? PoeStatus.UNKNOWN;
  return mode === PoeMode.OFF ? PoeStatus.OFF : PoeStatus.UNKNOWN;
}

function powerOf(live: Row): number | null {
  const power = parseMeasure(live['poe-out-power']);
  if (power !== null) return power;
  const voltage = parseMeasure(live['poe-out-voltage']);
  const currentMa = parseMeasure(live['poe-out-current']);
  return voltage !== null && currentMa !== null
    ? Math.round(voltage * currentMa) / 1000
    : null;
}

async function connectWithRouterOsApi(
  connection: PoeSwitchConnection,
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
