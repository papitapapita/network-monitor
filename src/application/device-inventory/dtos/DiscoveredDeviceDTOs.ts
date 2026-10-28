import { DiscoverySource } from 'domain/device-inventory/enums';

export interface DiscoveredDeviceDTO {
  id: string;
  macAddress: string;
  ipAddress: string | null;
  manufacturer: string | null;
  source: DiscoverySource;
  segment: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  ignoredAt: string | null;
}

export interface ListDiscoveredDevicesRequestDTO {
  ignored: boolean;
}

export interface DiscoveredDeviceIdRequestDTO {
  id: string;
}
