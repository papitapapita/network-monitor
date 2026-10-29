export interface RouterRefDTO {
  routerDeviceId: string;
  routerName: string;
}

export interface NetworkSightingDTO extends RouterRefDTO {
  port: string;
  portComment: string | null;
  // which of the device's MACs the router learned there
  macAddress: string;
  // DEV-199: no other router that sees the device sits behind this port
  closest: boolean;
}

export interface UnreadRouterDTO {
  deviceId: string;
  name: string;
  reason: string;
}

export interface GetDeviceNetworkLocationRequestDTO {
  deviceId: string;
}

export interface DeviceNetworkLocationResponseDTO {
  deviceId: string;
  deviceName: string;
  // the MACs looked for: the device's own, and the ones the routers' ARP
  // tables give for its IP
  macAddresses: string[];
  // the one closest sighting; null when not seen, or when it cannot be told
  location: NetworkSightingDTO | null;
  sightings: NetworkSightingDTO[];
  unreadRouters: UnreadRouterDTO[];
}

export type AddressMismatchKind = 'OTHER_DEVICE' | 'UNKNOWN_MAC';

export interface AddressMismatchDTO {
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  macAddressesOnFile: string[];
  // the MAC the routers give for the device's IP
  seenMacAddress: string;
  // DEV-219: OTHER_DEVICE — inventory has that MAC on another device;
  // UNKNOWN_MAC — no device in inventory has it
  kind: AddressMismatchKind;
  otherDeviceId: string | null;
  otherDeviceName: string | null;
  seenBy: RouterRefDTO[];
}

export interface AddressMismatchesResponseDTO {
  mismatches: AddressMismatchDTO[];
  unreadRouters: UnreadRouterDTO[];
}
