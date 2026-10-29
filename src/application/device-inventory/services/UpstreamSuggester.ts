import {
  PoweringSwitchRow,
  ReportedApRow,
  TopologyDeviceRow
} from '../interfaces';
import { UpstreamSuggestionDTO } from '../dtos';
import { RouterNeighborLink } from './RouterNeighborMap';

const ON_NETWORK = new Set(['ACTIVE', 'COMMISSIONING']);

// DEV-190..193: proposes an upstream for each device on the network from what
// other contexts observe. Proposes only; nothing here links anything.
export class UpstreamSuggester {
  private readonly byId: Map<string, TopologyDeviceRow>;

  constructor(rows: TopologyDeviceRow[]) {
    this.byId = new Map(rows.map((r) => [r.id, r]));
  }

  suggest(
    reportedAps: ReportedApRow[],
    poweringSwitches: PoweringSwitchRow[],
    neighborLinks: RouterNeighborLink[],
    locationId: string | null
  ): UpstreamSuggestionDTO[] {
    const stations = new Set(reportedAps.map((r) => r.stationId));
    const proposals = new Map<string, UpstreamSuggestionDTO>();

    for (const reported of reportedAps) {
      if (reported.apDeviceId === null) continue;
      const suggestion = this.propose(
        reported.stationId,
        reported.apDeviceId,
        locationId
      );
      if (!suggestion) continue;
      proposals.set(reported.stationId, {
        ...suggestion,
        source: 'WIRELESS',
        matchedBy: reported.matchedBy,
        observedAt: reported.observedAt?.toISOString() ?? null
      });
    }

    // DEV-191: a station's switch can hang off the station itself (the far
    // end of a backhaul), so for a station the radio is the only evidence.
    for (const powered of poweringSwitches) {
      if (stations.has(powered.deviceId)) continue;
      if (proposals.has(powered.deviceId)) continue;
      const suggestion = this.propose(
        powered.deviceId,
        powered.switchDeviceId,
        locationId
      );
      if (!suggestion) continue;
      proposals.set(powered.deviceId, {
        ...suggestion,
        source: 'POE',
        port: powered.port
      });
    }

    // DEV-196: the router port a device is cabled to, weighed last: the
    // radio and the PoE port are surer.
    for (const link of neighborLinks) {
      if (stations.has(link.deviceId)) continue;
      if (proposals.has(link.deviceId)) continue;
      const suggestion = this.propose(
        link.deviceId,
        link.routerDeviceId,
        locationId
      );
      if (!suggestion) continue;
      proposals.set(link.deviceId, {
        ...suggestion,
        source: 'ROUTER_NEIGHBOR',
        port: link.port
      });
    }

    return [...this.byId.keys()]
      .filter((id) => proposals.has(id))
      .map((id) => proposals.get(id)!);
  }

  // DEV-192, DEV-193: only a proposal the link rules would accept, and that
  // changes something.
  private propose(
    deviceId: string,
    upstreamId: string,
    locationId: string | null
  ): UpstreamSuggestionDTO | null {
    const device = this.byId.get(deviceId);
    const upstream = this.byId.get(upstreamId);
    if (!device || !upstream) return null;
    if (!ON_NETWORK.has(device.status)) return null;
    if (!ON_NETWORK.has(upstream.status)) return null;
    if (locationId !== null && device.locationId !== locationId)
      return null;
    if (deviceId === upstreamId) return null;
    if (device.upstreamDeviceId === upstreamId) return null;
    if (this.isBelow(upstreamId, deviceId)) return null;

    const current = device.upstreamDeviceId
      ? (this.byId.get(device.upstreamDeviceId) ?? null)
      : null;
    return {
      deviceId,
      deviceName: device.name,
      ipAddress: device.ipAddress,
      locationName: device.locationName,
      currentUpstreamDeviceId: device.upstreamDeviceId,
      currentUpstreamDeviceName: current?.name ?? null,
      suggestedUpstreamDeviceId: upstreamId,
      suggestedUpstreamDeviceName: upstream.name,
      source: 'WIRELESS',
      matchedBy: null,
      observedAt: null,
      port: null
    };
  }

  private isBelow(id: string, ancestorId: string): boolean {
    const seen = new Set<string>();
    let next = this.byId.get(id)?.upstreamDeviceId ?? null;
    while (next !== null && !seen.has(next)) {
      if (next === ancestorId) return true;
      seen.add(next);
      next = this.byId.get(next)?.upstreamDeviceId ?? null;
    }
    return false;
  }
}
