import { Result } from 'domain/shared/core';
import { MACAddress } from 'domain/shared/value-objects';
import { DiscoveredDevice } from 'domain/device-inventory/aggregates';
import { DiscoverySource } from 'domain/device-inventory/enums';
import { IDiscoveredDeviceRepository } from 'domain/device-inventory/repository';
import {
  IDiscoveryNotifier,
  IKnownDeviceLookup
} from '../interfaces';

export interface SightedHost {
  macAddress: string | null;
  ipAddress: string | null;
  manufacturer: string | null;
  hostname?: string | null;
  model?: string | null;
}

export interface SightingBatch {
  source: DiscoverySource;
  segment: string | null;
  accessPointId?: string | null;
  // How the notice names where they were seen.
  where: string;
  seenAt: Date;
  hosts: SightedHost[];
}

export interface SightingOutcome {
  knownDeviceId: string | null;
  discoveredDeviceId: string | null;
  isNew: boolean;
}

// Turns what the network showed into suggestions (DEV-200..206). Shared by
// every source, so a scan and an AP's station list agree on what is new.
export class DeviceSightingRecorder {
  constructor(
    private readonly repository: IDiscoveredDeviceRepository,
    private readonly knownDevices: IKnownDeviceLookup,
    private readonly notifier: IDiscoveryNotifier
  ) {}

  async record(
    batch: SightingBatch
  ): Promise<Result<SightingOutcome[]>> {
    const macs = uniqueMacs(batch.hosts);
    const ips = batch.hosts
      .map((h) => h.ipAddress)
      .filter((ip): ip is string => !!ip);

    const owners = await this.knownDevices.findOwners(
      macs.filter((m): m is string => m !== null),
      ips
    );
    if (owners.isFailure) {
      return Result.fail(
        `Failed to match sightings with inventory: ${owners.error}`
      );
    }

    const knownIds = batch.hosts.map(
      (host, i) =>
        (macs[i] && owners.value.byMac.get(macs[i]!)) ||
        (host.ipAddress && owners.value.byIp.get(host.ipAddress)) ||
        null
    );

    // DEV-203: a MAC inventory now owns is no longer a suggestion.
    const knownMacs = macs.filter(
      (mac, i): mac is string => mac !== null && knownIds[i] !== null
    );
    if (knownMacs.length > 0) {
      const cleared = await this.repository.deleteByMacs(knownMacs);
      if (cleared.isFailure) {
        return Result.fail(
          `Failed to clear claimed suggestions: ${cleared.error}`
        );
      }
    }

    const unknown = new Map<string, SightedHost>();
    batch.hosts.forEach((host, i) => {
      if (macs[i] && knownIds[i] === null)
        unknown.set(macs[i]!, host);
    });

    const existing = await this.repository.findByMacs([
      ...unknown.keys()
    ]);
    if (existing.isFailure) {
      return Result.fail(
        `Failed to load discovered devices: ${existing.error}`
      );
    }
    const byMac = new Map(
      existing.value.map((d) => [d.macAddress, d])
    );
    const created = new Set<string>();

    for (const [mac, host] of unknown) {
      const sighting = {
        macAddress: mac,
        ipAddress: host.ipAddress,
        manufacturer: host.manufacturer,
        source: batch.source,
        segment: batch.segment,
        hostname: host.hostname ?? null,
        model: host.model ?? null,
        accessPointId: batch.accessPointId ?? null,
        seenAt: batch.seenAt
      };
      const found = byMac.get(mac);
      if (found) {
        const sighted = found.sighted(sighting);
        if (sighted.isFailure) return Result.fail(sighted.error);
        continue;
      }
      const fresh = DiscoveredDevice.create(sighting);
      if (fresh.isFailure) return Result.fail(fresh.error);
      byMac.set(mac, fresh.value);
      created.add(mac);
    }

    const saved = await this.repository.saveMany([...byMac.values()]);
    if (saved.isFailure) {
      return Result.fail(
        `Failed to save discovered devices: ${saved.error}`
      );
    }

    if (created.size > 0) {
      await this.notifier.newDevicesFound({
        count: created.size,
        where: batch.where,
        occurredAt: batch.seenAt
      });
    }

    return Result.ok(
      batch.hosts.map((_, i) => {
        const mac = macs[i];
        const suggestion =
          mac && knownIds[i] === null ? byMac.get(mac) : undefined;
        return {
          knownDeviceId: knownIds[i],
          discoveredDeviceId: suggestion?.id.toString() ?? null,
          isNew: !!mac && created.has(mac) && knownIds[i] === null
        };
      })
    );
  }
}

// DEV-200: a host with no readable MAC has no stable key, so it is never
// stored; it can still match inventory by IP.
function normalizeMac(mac: string | null): string | null {
  if (!mac) return null;
  const parsed = MACAddress.create(mac);
  return parsed.isSuccess ? parsed.value.value : null;
}

// DEV-207: a MAC answering for several addresses is a router doing proxy ARP,
// not the hosts themselves, so none of them is matched or stored by it.
function uniqueMacs(hosts: SightedHost[]): (string | null)[] {
  const macs = hosts.map((h) => normalizeMac(h.macAddress));
  const ipsPerMac = new Map<string, Set<string | null>>();
  hosts.forEach((host, i) => {
    const mac = macs[i];
    if (!mac) return;
    const ips = ipsPerMac.get(mac) ?? new Set<string | null>();
    ips.add(host.ipAddress);
    ipsPerMac.set(mac, ips);
  });
  return macs.map((mac) =>
    mac && ipsPerMac.get(mac)!.size === 1 ? mac : null
  );
}
