import { DiscoverySource } from '../enums';

export interface DiscoveredDeviceProps {
  macAddress: string;
  ipAddress: string | null;
  manufacturer: string | null;
  source: DiscoverySource;
  segment: string | null;
  // AirOS reports these for a station: its radio name and platform.
  hostname: string | null;
  model: string | null;
  // The AP whose station list showed it last; no FK, like the MAC match.
  accessPointId: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  ignoredAt: Date | null;
}

export interface DeviceSighting {
  macAddress: string;
  ipAddress: string | null;
  manufacturer: string | null;
  source: DiscoverySource;
  segment: string | null;
  hostname: string | null;
  model: string | null;
  accessPointId: string | null;
  seenAt: Date;
}
