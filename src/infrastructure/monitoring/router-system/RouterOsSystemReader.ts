import { Result } from 'domain/shared/core';
import type {
  IRouterOsPrinter,
  IRouterSystemReader,
  RouterOsCommand,
  RouterOsPrintAnswer,
  RouterOsRow,
  RouterPortConnection,
  RouterSystemReading
} from 'application/device-monitoring/interfaces';

const COMMANDS: RouterOsCommand[] = [
  { command: '/system/identity/print', params: [] },
  { command: '/system/resource/print', params: [] },
  { command: '/system/routerboard/print', params: [] },
  { command: '/system/health/print', params: [] },
  {
    command: '/interface/ethernet/print',
    params: [
      '=.proplist=name,default-name,mac-address,orig-mac-address'
    ]
  }
];

const MAC = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/;
// RouterOS uptime: 2w3d04:05:06 on some versions, 2w3d4h5m6s on others.
const UPTIME_UNITS: Record<string, number> = {
  w: 604_800,
  d: 86_400,
  h: 3_600,
  m: 60,
  s: 1
};

// MON-160: one login through the printer, five reads. A command the router
// refuses (a CHR has no RouterBOARD, many boards no health sensors) leaves
// its fields null; only a router that answers neither its identity nor its
// resources fails the read.
export class RouterOsSystemReader implements IRouterSystemReader {
  constructor(private readonly printer: IRouterOsPrinter) {}

  async read(
    connection: RouterPortConnection
  ): Promise<Result<RouterSystemReading>> {
    const printed = await this.printer.print(connection, COMMANDS);
    if (printed.isFailure) return Result.fail(printed.error);

    const [identity, resource, routerboard, health, ethernet] =
      printed.value;
    if (!hasRows(identity) && !hasRows(resource)) {
      return Result.fail(
        `RouterOS API error: ${errorOf(resource) ?? errorOf(identity) ?? 'no answer'}`
      );
    }
    return Result.ok(
      parseSystem({
        identity: firstRow(identity),
        resource: firstRow(resource),
        routerboard: firstRow(routerboard),
        health: rowsOf(health),
        ethernet: rowsOf(ethernet)
      })
    );
  }
}

interface SystemRows {
  identity: RouterOsRow;
  resource: RouterOsRow;
  routerboard: RouterOsRow;
  health: RouterOsRow[];
  ethernet: RouterOsRow[];
}

export function parseSystem(rows: SystemRows): RouterSystemReading {
  const { identity, resource, routerboard } = rows;
  const health = healthValues(rows.health);
  return {
    identity: text(identity.name, 255),
    model: text(routerboard.model, 100),
    serialNumber: text(routerboard['serial-number'], 100),
    macAddress: firstPortMac(rows.ethernet),
    boardName: text(resource['board-name'], 100),
    routerOsVersion: text(resource.version?.split(' ')[0], 50),
    currentFirmware: text(routerboard['current-firmware'], 50),
    upgradeFirmware: text(routerboard['upgrade-firmware'], 50),
    uptimeSeconds: parseUptime(resource.uptime),
    cpuLoadPercent: percent(resource['cpu-load']),
    freeMemoryBytes: count(resource['free-memory']),
    totalMemoryBytes: count(resource['total-memory']),
    freeHddBytes: count(resource['free-hdd-space']),
    totalHddBytes: count(resource['total-hdd-space']),
    voltage: decimal(health.voltage),
    temperatureC: decimal(
      health.temperature ??
        health['board-temperature1'] ??
        health['cpu-temperature']
    )
  };
}

// RouterOS 6 answers one row of fields (voltage=24.1); RouterOS 7 answers
// one row per sensor (name=voltage value=24.1 type=V).
function healthValues(rows: RouterOsRow[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const row of rows) {
    if (row.name !== undefined && row.value !== undefined) {
      values[row.name] = row.value;
    } else {
      Object.assign(values, row);
    }
  }
  return values;
}

// The factory MAC of ether1, the address printed on the box; any first port
// when the router has no ether1.
function firstPortMac(rows: RouterOsRow[]): string | null {
  const port =
    rows.find((r) => (r['default-name'] ?? r.name) === 'ether1') ??
    rows[0];
  const raw = (
    port?.['orig-mac-address'] ?? port?.['mac-address']
  )?.toUpperCase();
  return raw && MAC.test(raw) ? raw : null;
}

export function parseUptime(raw: string | undefined): number | null {
  if (!raw) return null;
  let seconds = 0;
  let rest = raw.trim();
  const clock = /(\d+):(\d{2}):(\d{2})$/.exec(rest);
  if (clock) {
    seconds +=
      Number(clock[1]) * 3600 +
      Number(clock[2]) * 60 +
      Number(clock[3]);
    rest = rest.slice(0, clock.index);
  }
  const unit = /(\d+)([wdhms])/g;
  let consumed = '';
  for (const match of rest.matchAll(unit)) {
    seconds += Number(match[1]) * UPTIME_UNITS[match[2]!]!;
    consumed += match[0];
  }
  if (consumed !== rest || (!clock && consumed === '')) return null;
  return seconds;
}

function text(raw: string | undefined, max: number): string | null {
  const value = raw?.trim();
  return value ? value.slice(0, max) : null;
}

function count(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw.trim())) return null;
  return Number(raw);
}

function percent(raw: string | undefined): number | null {
  const value = count(raw);
  return value !== null && value <= 100 ? value : null;
}

function decimal(raw: string | undefined): number | null {
  const value = raw === undefined ? NaN : Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

function hasRows(answer: RouterOsPrintAnswer | undefined): boolean {
  return !!answer && 'rows' in answer && answer.rows.length > 0;
}

function rowsOf(
  answer: RouterOsPrintAnswer | undefined
): RouterOsRow[] {
  return answer && 'rows' in answer ? answer.rows : [];
}

function firstRow(
  answer: RouterOsPrintAnswer | undefined
): RouterOsRow {
  return rowsOf(answer)[0] ?? {};
}

function errorOf(
  answer: RouterOsPrintAnswer | undefined
): string | null {
  return answer && 'error' in answer ? answer.error : null;
}
