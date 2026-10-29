import { DeviceAddressRow, RouterHostsRow } from '../interfaces';
import {
  AddressMismatchDTO,
  NetworkSightingDTO,
  RouterRefDTO,
  UnreadRouterDTO
} from '../dtos';

const ON_NETWORK = new Set(['ACTIVE', 'COMMISSIONING']);

export const NO_BRIDGE_HOSTS =
  'The router did not answer its bridge host table';
export const NO_ADDRESS_TABLES =
  'The router did not answer its ARP table or DHCP leases';

// DEV-199: every router whose bridge learned one of the MACs, and on which
// port. On a flat bridge every router on the way sees the device, so a
// sighting is closest unless another router that also sees it sits behind
// that same port — the device is further down, behind that router.
export function locateOnNetwork(
  macAddresses: string[],
  routers: RouterHostsRow[]
): NetworkSightingDTO[] {
  const wanted = new Set(macAddresses);
  const found = routers.flatMap((router) => {
    const host = router.bridgeHosts?.find(
      (h) => !h.local && wanted.has(h.macAddress)
    );
    return host ? [{ router, host }] : [];
  });

  return found.map(({ router, host }) => {
    const behindPort = new Set(
      router
        .bridgeHosts!.filter((h) => !h.local && h.port === host.port)
        .map((h) => h.macAddress)
    );
    const closer = found.some(
      (other) =>
        other.router !== router &&
        other.router.bridgeHosts!.some(
          (h) => h.local && behindPort.has(h.macAddress)
        )
    );
    return {
      routerDeviceId: router.routerDeviceId,
      routerName: router.routerName,
      port: host.port,
      portComment:
        router.ports.find((p) => p.name === host.port)?.comment ??
        null,
      macAddress: host.macAddress,
      closest: !closer
    };
  });
}

// DEV-199: the MACs the routers' ARP tables give for an IP.
export function arpMacsOf(
  ipAddress: string,
  routers: RouterHostsRow[]
): string[] {
  const macs = routers.flatMap((router) =>
    addressTable(router)
      .filter((e) => e.ipAddress === ipAddress)
      .map((e) => e.macAddress)
  );
  return [...new Set(macs)];
}

// DEV-219: a device in service whose IP the routers give to a MAC that is
// none of its own: the IP on file is wrong, or two devices share it.
export function findAddressMismatches(
  devices: DeviceAddressRow[],
  routers: RouterHostsRow[]
): AddressMismatchDTO[] {
  const ownerOf = new Map<string, DeviceAddressRow>();
  for (const device of devices) {
    for (const mac of device.macAddresses) {
      if (!ownerOf.has(mac)) ownerOf.set(mac, device);
    }
  }
  const tables = routers.map((router) => ({
    router,
    entries: addressTable(router)
  }));

  const mismatches = new Map<string, AddressMismatchDTO>();
  for (const device of devices) {
    const ip = device.ipAddress;
    if (!ip || !ON_NETWORK.has(device.status)) continue;
    if (device.macAddresses.length === 0) continue;
    for (const { router, entries } of tables) {
      for (const entry of entries) {
        if (entry.ipAddress !== ip) continue;
        if (device.macAddresses.includes(entry.macAddress)) continue;
        const key = `${device.id}>${entry.macAddress}`;
        const seenBy: RouterRefDTO = {
          routerDeviceId: router.routerDeviceId,
          routerName: router.routerName
        };
        const known = mismatches.get(key);
        if (known) {
          if (
            !known.seenBy.some(
              (r) => r.routerDeviceId === router.routerDeviceId
            )
          ) {
            known.seenBy.push(seenBy);
          }
          continue;
        }
        const other = ownerOf.get(entry.macAddress) ?? null;
        mismatches.set(key, {
          deviceId: device.id,
          deviceName: device.name,
          ipAddress: ip,
          macAddressesOnFile: [...device.macAddresses],
          seenMacAddress: entry.macAddress,
          kind: other ? 'OTHER_DEVICE' : 'UNKNOWN_MAC',
          otherDeviceId: other?.id ?? null,
          otherDeviceName: other?.name ?? null,
          seenBy: [seenBy]
        });
      }
    }
  }
  return [...mismatches.values()];
}

export function routersWithout(
  routers: RouterHostsRow[],
  table: 'bridgeHosts' | 'addresses'
): UnreadRouterDTO[] {
  return routers
    .filter((r) =>
      table === 'bridgeHosts'
        ? r.bridgeHosts === null
        : r.arp === null && r.leases === null
    )
    .map((r) => ({
      deviceId: r.routerDeviceId,
      name: r.routerName,
      reason:
        table === 'bridgeHosts' ? NO_BRIDGE_HOSTS : NO_ADDRESS_TABLES
    }));
}

// The router's IP ↔ MAC pairs from ARP and bound leases. DEV-207: a MAC
// answering for several addresses is a router doing proxy ARP, so none of
// its pairs say who holds the address.
function addressTable(
  router: RouterHostsRow
): { ipAddress: string; macAddress: string }[] {
  const pairs = [...(router.arp ?? []), ...(router.leases ?? [])];
  const ipsPerMac = new Map<string, Set<string>>();
  for (const p of pairs) {
    const ips = ipsPerMac.get(p.macAddress) ?? new Set<string>();
    ips.add(p.ipAddress);
    ipsPerMac.set(p.macAddress, ips);
  }
  const seen = new Set<string>();
  return pairs.filter((p) => {
    const key = `${p.ipAddress}>${p.macAddress}`;
    if (seen.has(key) || ipsPerMac.get(p.macAddress)!.size > 1) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
