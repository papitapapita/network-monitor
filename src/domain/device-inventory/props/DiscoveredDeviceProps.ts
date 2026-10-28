import { DiscoverySource } from '../enums';

export interface DiscoveredDeviceProps {
  macAddress: string;
  ipAddress: string | null;
  manufacturer: string | null;
  source: DiscoverySource;
  segment: string | null;
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
  seenAt: Date;
}
