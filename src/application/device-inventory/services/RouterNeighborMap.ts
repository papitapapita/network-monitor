import { Result } from 'domain/shared/core';
import { MACAddress } from 'domain/shared/value-objects';
import {
  IKnownDeviceLookup,
  KnownDeviceOwners,
  RouterNeighborRow,
  RouterNeighborsRow,
  TopologyDeviceRow
} from '../interfaces';
import { RouterNeighborDTO, RouterPortNeighborsDTO } from '../dtos';

// DEV-197: the far end announced over its own radio.
const WIRELESS_INTERFACE = /^(ath|wlan|wifi)/i;

export interface RouterNeighborLink {
  deviceId: string;
  routerDeviceId: string;
  port: string;
}

// DEV-196..198: what each MikroTik port hears, matched with inventory. The
// network is one flat bridge, so being heard is not being next door: only a
// port that hears exactly one device over a cable, and is not the uplink,
// says who is plugged into it.
export class RouterNeighborMap {
  private readonly byId: Map<string, TopologyDeviceRow>;

  constructor(
    private readonly routers: RouterNeighborsRow[],
    private readonly owners: KnownDeviceOwners,
    rows: TopologyDeviceRow[]
  ) {
    this.byId = new Map(rows.map((r) => [r.id, r]));
  }

  ports(routerDeviceId: string): RouterPortNeighborsDTO[] {
    const router = this.routers.find(
      (r) => r.routerDeviceId === routerDeviceId
    );
    if (!router) return [];

    const comments = new Map(
      router.ports.map((p) => [p.name, p.comment])
    );
    const names = [
      ...router.ports.map((p) => p.name),
      ...router.neighbors.map((n) => n.port)
    ].filter((name, i, all) => all.indexOf(name) === i);

    return names.map((port) => {
      const neighbors = router.neighbors
        .filter((n) => n.port === port)
        .map((n) => this.toDTO(n, routerDeviceId));
      const uplink = this.isUplink(routerDeviceId, neighbors);
      const comment = comments.get(port) ?? null;
      const clear = uplink ? null : clearNeighbor(neighbors);
      const name = clear?.knownDeviceName ?? null;
      return {
        port,
        comment,
        uplink,
        neighbors,
        suggestedComment:
          name &&
          !(comment ?? '').toLowerCase().includes(name.toLowerCase())
            ? name
            : null
      };
    });
  }

  // DEV-196: one link per device clearly cabled to one port. A device that
  // looks cabled to two ports, or two routers each clearly hearing the
  // other (which one leads up cannot be told), are left out.
  links(): RouterNeighborLink[] {
    const links = this.candidateLinks();
    const pairs = new Set(
      links.map((l) => `${l.deviceId}>${l.routerDeviceId}`)
    );
    return links.filter(
      (l) => !pairs.has(`${l.routerDeviceId}>${l.deviceId}`)
    );
  }

  private candidateLinks(): RouterNeighborLink[] {
    const found = new Map<string, RouterNeighborLink | null>();
    for (const router of this.routers) {
      for (const port of this.ports(router.routerDeviceId)) {
        if (port.uplink) continue;
        const clear = clearNeighbor(port.neighbors);
        if (!clear?.knownDeviceId) continue;
        const id = clear.knownDeviceId;
        found.set(
          id,
          found.has(id)
            ? null
            : {
                deviceId: id,
                routerDeviceId: router.routerDeviceId,
                port: port.port
              }
        );
      }
    }
    return [...found.values()].filter(
      (l): l is RouterNeighborLink => l !== null
    );
  }

  private toDTO(
    neighbor: RouterNeighborRow,
    routerDeviceId: string
  ): RouterNeighborDTO {
    const owner = this.ownerOf(neighbor);
    const knownDeviceId = owner === routerDeviceId ? null : owner;
    const remote = neighbor.remoteInterface?.split('/').pop() ?? '';
    return {
      macAddress: neighbor.macAddress,
      ipAddress: neighbor.ipAddress,
      identity: neighbor.identity,
      platform: neighbor.platform,
      board: neighbor.board,
      version: neighbor.version,
      remoteInterface: neighbor.remoteInterface,
      wireless: WIRELESS_INTERFACE.test(remote),
      knownDeviceId,
      knownDeviceName: knownDeviceId
        ? (this.byId.get(knownDeviceId)?.name ?? null)
        : null
    };
  }

  private ownerOf(neighbor: RouterNeighborRow): string | null {
    const mac = neighbor.macAddress
      ? MACAddress.create(neighbor.macAddress)
      : null;
    return (
      (mac?.isSuccess && this.owners.byMac.get(mac.value.value)) ||
      (neighbor.ipAddress &&
        this.owners.byIp.get(neighbor.ipAddress)) ||
      null
    );
  }

  // DEV-197: the port that hears the gateway or anything the router hangs
  // from in the tree leads up, not down.
  private isUplink(
    routerDeviceId: string,
    neighbors: RouterNeighborDTO[]
  ): boolean {
    const above = new Set<string>();
    let next =
      this.byId.get(routerDeviceId)?.upstreamDeviceId ?? null;
    while (next !== null && !above.has(next)) {
      above.add(next);
      next = this.byId.get(next)?.upstreamDeviceId ?? null;
    }
    return neighbors.some(
      (n) =>
        n.knownDeviceId !== null &&
        (above.has(n.knownDeviceId) ||
          this.byId.get(n.knownDeviceId)?.category === 'GATEWAY')
    );
  }
}

// DEV-197: exactly one device heard over the cable — the same device under
// two entries (MNDP and LLDP) counts once — and inventory knows it.
function clearNeighbor(
  neighbors: RouterNeighborDTO[]
): RouterNeighborDTO | null {
  const wired = new Map<string, RouterNeighborDTO>();
  for (const n of neighbors) {
    if (n.wireless) continue;
    const key =
      n.knownDeviceId ??
      n.macAddress ??
      n.ipAddress ??
      n.identity ??
      '';
    wired.set(key, n);
  }
  if (wired.size !== 1) return null;
  const only = [...wired.values()][0]!;
  return only.knownDeviceId ? only : null;
}

// DEV-201: the inventory devices that own the MACs and IPs the routers hear.
export async function findNeighborOwners(
  knownDevices: IKnownDeviceLookup,
  routers: RouterNeighborsRow[]
): Promise<Result<KnownDeviceOwners>> {
  const neighbors = routers.flatMap((r) => r.neighbors);
  const macs = neighbors
    .map((n) =>
      n.macAddress ? MACAddress.create(n.macAddress) : null
    )
    .filter((m) => m?.isSuccess)
    .map((m) => m!.value.value);
  const ips = neighbors
    .map((n) => n.ipAddress)
    .filter((ip): ip is string => ip !== null);
  if (macs.length === 0 && ips.length === 0) {
    return Result.ok({ byMac: new Map(), byIp: new Map() });
  }
  const owners = await knownDevices.findOwners(
    [...new Set(macs)],
    [...new Set(ips)]
  );
  return owners.isFailure
    ? Result.fail(
        `Failed to match neighbours with inventory: ${owners.error}`
      )
    : owners;
}
