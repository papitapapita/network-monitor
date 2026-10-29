export interface RouterNeighborDTO {
  macAddress: string | null;
  ipAddress: string | null;
  identity: string | null;
  platform: string | null;
  board: string | null;
  version: string | null;
  // the neighbour's own interface it announced from: "br0", "ath0"…
  remoteInterface: string | null;
  // DEV-197: announced over its own radio (ath*, wlan*, wifi*), so heard
  // through an AP rather than over this port's cable
  wireless: boolean;
  // DEV-201: the inventory device with its MAC, or else its IP
  knownDeviceId: string | null;
  knownDeviceName: string | null;
}

export interface RouterPortNeighborsDTO {
  port: string;
  comment: string | null;
  // DEV-197: the port toward the gateway; it hears the whole flat network
  uplink: boolean;
  neighbors: RouterNeighborDTO[];
  // DEV-198: the one device clearly cabled to this port, when its comment
  // does not name it yet
  suggestedComment: string | null;
}

export interface GetRouterNeighborsRequestDTO {
  deviceId: string;
}

export interface RouterNeighborsResponseDTO {
  deviceId: string;
  deviceName: string;
  // why the router could not be read; ports is then empty
  reason: string | null;
  ports: RouterPortNeighborsDTO[];
}
