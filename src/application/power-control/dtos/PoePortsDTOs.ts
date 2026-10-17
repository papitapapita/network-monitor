export interface PoePortMatchDTO {
  kind: string;
  ip: string | null;
  deviceId: string | null;
  deviceName: string | null;
  deviceLocationName: string | null;
}

export interface PoePortDTO {
  port: string;
  label: string;
  mode: string;
  status: string;
  powerWatts: number | null;
  voltage: number | null;
  match: PoePortMatchDTO;
}

export interface PoeSwitchDTO {
  deviceId: string;
  name: string;
  ipAddress: string | null;
  firmware: string;
  firmwareVersion: string | null;
  // false: not read at all, and `reason` says why
  readable: boolean;
  reason: string | null;
  // set when the switch was tried and did not answer
  error: string | null;
  ports: PoePortDTO[];
}

export interface ListSitePoePortsRequestDTO {
  locationId: string;
}

export interface SitePoePortsResponseDTO {
  locationId: string;
  locationName: string;
  switches: PoeSwitchDTO[];
}

export interface GetDevicePowerSourceRequestDTO {
  deviceId: string;
}

export interface PowerSourcePortDTO {
  switchDeviceId: string;
  switchName: string;
  port: string;
  mode: string;
  status: string;
  powerWatts: number | null;
}

export interface UnreadPoeSwitchDTO {
  deviceId: string;
  name: string;
  reason: string;
}

// PWR-040: FOUND, one port; DUPLICATE, more than one; NONE, every switch at
// the site was read and none powers it; UNKNOWN, none found but a switch at
// the site could not be read.
export type PowerSourceKind =
  | 'FOUND'
  | 'DUPLICATE'
  | 'NONE'
  | 'UNKNOWN';

export interface DevicePowerSourceResponseDTO {
  deviceId: string;
  kind: PowerSourceKind;
  reason: string | null;
  sources: PowerSourcePortDTO[];
  unreadSwitches: UnreadPoeSwitchDTO[];
}
