import { Result } from 'domain/shared/core';
import type {
  IRouterHostReader,
  IRouterOsPrinter,
  RouterArpEntry,
  RouterBridgeHost,
  RouterDhcpLease,
  RouterHostsReading,
  RouterOsPrintAnswer,
  RouterOsCommand,
  RouterOsRow,
  RouterPortConnection
} from 'application/device-monitoring/interfaces';

const COMMANDS: RouterOsCommand[] = [
  {
    command: '/interface/ethernet/print',
    params: ['=.proplist=name,comment']
  },
  {
    // RouterOS 6 names the port `on-interface`, 7 names it `interface`
    command: '/interface/bridge/host/print',
    params: [
      '=.proplist=mac-address,interface,on-interface,local,disabled,invalid'
    ]
  },
  { command: '/ip/arp/print', params: [] },
  { command: '/ip/dhcp-server/lease/print', params: [] }
];

const MAC = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/i;
const NO_MAC = '00:00:00:00:00:00';
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const MAX_TEXT = 100;
// RouterOS 7's neighbour states that hold no MAC worth trusting
const UNRESOLVED_ARP = new Set(['failed', 'incomplete']);

// MON-202: one login through the printer for the port comments, the bridge
// host table, the ARP table and the DHCP leases. A refused table is null;
// only the login failing fails the read.
export class RouterOsHostReader implements IRouterHostReader {
  constructor(private readonly printer: IRouterOsPrinter) {}

  async read(
    connection: RouterPortConnection
  ): Promise<Result<RouterHostsReading>> {
    const printed = await this.printer.print(connection, COMMANDS);
    if (printed.isFailure) return Result.fail(printed.error);

    const [ethernet, hosts, arp, leases] = printed.value;
    return Result.ok({
      ports: (rowsOf(ethernet) ?? [])
        .filter((r) => !!r.name)
        .map((r) => ({ name: r.name!, comment: text(r.comment) })),
      bridgeHosts: parsed(hosts, parseBridgeHost),
      arp: parsed(arp, parseArpEntry),
      leases: parsed(leases, parseDhcpLease)
    });
  }
}

export function parseBridgeHost(
  row: RouterOsRow
): RouterBridgeHost | null {
  if (flag(row.disabled) || flag(row.invalid)) return null;
  const macAddress = mac(row['mac-address']);
  const port = (row.interface ?? row['on-interface'])?.trim();
  if (!macAddress || !port) return null;
  return { macAddress, port, local: flag(row.local) };
}

export function parseArpEntry(
  row: RouterOsRow
): RouterArpEntry | null {
  if (
    flag(row.disabled) ||
    flag(row.invalid) ||
    flag(row.published) ||
    UNRESOLVED_ARP.has(row.status?.trim() ?? '')
  ) {
    return null;
  }
  const ipAddress = ipv4(row.address);
  const macAddress = mac(row['mac-address']);
  if (!ipAddress || !macAddress) return null;
  return {
    ipAddress,
    macAddress,
    interface: text(row.interface)
  };
}

// Only a bound lease says who holds the address now.
export function parseDhcpLease(
  row: RouterOsRow
): RouterDhcpLease | null {
  if (flag(row.disabled) || row.status?.trim() !== 'bound')
    return null;
  const ipAddress = ipv4(row['active-address']) ?? ipv4(row.address);
  const macAddress =
    mac(row['active-mac-address']) ?? mac(row['mac-address']);
  if (!ipAddress || !macAddress) return null;
  return { ipAddress, macAddress, hostname: text(row['host-name']) };
}

function rowsOf(
  answer: RouterOsPrintAnswer | undefined
): RouterOsRow[] | null {
  return answer && 'rows' in answer ? answer.rows : null;
}

function parsed<T>(
  answer: RouterOsPrintAnswer | undefined,
  parse: (row: RouterOsRow) => T | null
): T[] | null {
  const rows = rowsOf(answer);
  if (rows === null) return null;
  return rows.map(parse).filter((v): v is T => v !== null);
}

function flag(raw: string | undefined): boolean {
  return raw?.trim() === 'true';
}

function mac(raw: string | undefined): string | null {
  const value = raw?.trim().toUpperCase() ?? '';
  return MAC.test(value) && value !== NO_MAC ? value : null;
}

function ipv4(raw: string | undefined): string | null {
  const match = IPV4.exec(raw?.trim() ?? '');
  if (!match) return null;
  return match.slice(1).every((part) => Number(part) <= 255)
    ? match[0]
    : null;
}

function text(raw: string | undefined): string | null {
  return raw?.trim().slice(0, MAX_TEXT) || null;
}
