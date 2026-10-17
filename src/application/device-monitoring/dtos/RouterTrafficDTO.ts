export interface RouterInterfaceTrafficDTO {
  name: string;
  // RouterOS's own interface type: ether, sfp-sfpplus, bridge, vlan, ...
  type: string;
  running: boolean;
  rxBps: number;
  txBps: number;
}

export interface RouterTrafficDTO {
  deviceId: string;
  deviceName: string;
  // When the router was last asked; null until the first read finishes.
  at: string | null;
  // Why there are no rates: the router cannot be read, or the last read
  // failed. Interfaces is empty whenever this is set.
  error: string | null;
  interfaces: RouterInterfaceTrafficDTO[];
}

export interface RouterTrafficSnapshotDTO {
  intervalSeconds: number;
  routers: RouterTrafficDTO[];
}
