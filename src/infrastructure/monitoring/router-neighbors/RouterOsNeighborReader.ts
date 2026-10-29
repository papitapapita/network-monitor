import { Result } from 'domain/shared/core';
import type {
  IRouterNeighborReader,
  IRouterOsPrinter,
  RouterNeighborReading,
  RouterNeighborsReading,
  RouterOsCommand,
  RouterOsRow,
  RouterPortConnection
} from 'application/device-monitoring/interfaces';

const COMMANDS: RouterOsCommand[] = [
  { command: '/ip/neighbor/print', params: [] },
  {
    command: '/interface/ethernet/print',
    params: ['=.proplist=name,comment']
  }
];

const MAC = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/i;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const MAX_TEXT = 100;

// MON-200: one login through the printer for the neighbour table and the
// port comments. Only a refused neighbour table fails the read.
export class RouterOsNeighborReader implements IRouterNeighborReader {
  constructor(private readonly printer: IRouterOsPrinter) {}

  async read(
    connection: RouterPortConnection
  ): Promise<Result<RouterNeighborsReading>> {
    const printed = await this.printer.print(connection, COMMANDS);
    if (printed.isFailure) return Result.fail(printed.error);

    const [neighbors, ethernet] = printed.value;
    if (!neighbors || 'error' in neighbors) {
      return Result.fail(
        `RouterOS API error: ${neighbors?.error ?? 'no answer'}`
      );
    }
    const ports =
      ethernet && 'rows' in ethernet
        ? ethernet.rows
            .filter((r) => !!r.name)
            .map((r) => ({
              name: r.name!,
              comment: text(r.comment)
            }))
        : [];
    return Result.ok({
      ports,
      neighbors: neighbors.rows
        .map(parseNeighbor)
        .filter((n): n is RouterNeighborReading => n !== null)
    });
  }
}

export function parseNeighbor(
  row: RouterOsRow
): RouterNeighborReading | null {
  // "ether2,bridge" on a bridge port: the port, then the bridge it is in
  const port = row.interface?.split(',')[0]?.trim();
  if (!port) return null;
  const mac = row['mac-address']?.trim() ?? '';
  return {
    port,
    macAddress: MAC.test(mac) ? mac.toUpperCase() : null,
    ipAddress: ipv4(row.address4) ?? ipv4(row.address),
    identity: text(row.identity),
    platform: text(row.platform),
    board: text(row.board),
    version: text(row.version),
    remoteInterface: text(row['interface-name'])
  };
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
