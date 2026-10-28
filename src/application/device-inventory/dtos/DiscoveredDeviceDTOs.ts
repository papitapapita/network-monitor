import { DiscoverySource } from 'domain/device-inventory/enums';

export interface DiscoveredDeviceDTO {
  id: string;
  macAddress: string;
  ipAddress: string | null;
  manufacturer: string | null;
  source: DiscoverySource;
  segment: string | null;
  hostname: string | null;
  model: string | null;
  accessPointId: string | null;
  // Filled by the list only; null too once that AP is deleted.
  accessPointName: string | null;
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

// What the create-device form starts from (DEV-209); every field stays the
// operator's to change.
export interface DiscoveredDevicePrefillDTO {
  name: string | null;
  macAddress: string;
  ipAddress: string | null;
  deviceModelId: string | null;
  deviceModelName: string | null;
  category: 'WIRELESS_CPE' | null;
  upstreamDeviceId: string | null;
  // Set only with an upstream AP: the agent that reads that AP.
  agentId?: string | null;
}
