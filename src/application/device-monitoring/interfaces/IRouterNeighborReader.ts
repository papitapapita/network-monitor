import { Result } from 'domain/shared/core';
import { RouterPortConnection } from './IRouterPortReader';

// One entry of a MikroTik's neighbour table (MNDP, CDP, LLDP), as heard on
// one of its ports. Null when the neighbour did not announce it.
export interface RouterNeighborReading {
  // the local port it was heard on
  port: string;
  macAddress: string | null;
  ipAddress: string | null;
  identity: string | null;
  platform: string | null;
  board: string | null;
  version: string | null;
  // the neighbour's own interface it announced from: "br0", "ath0",
  // "bridge-lan/ether4"
  remoteInterface: string | null;
}

export interface RouterPortLabel {
  name: string;
  comment: string | null;
}

export interface RouterNeighborsReading {
  // the Ethernet ports with their comments; empty when that read failed
  ports: RouterPortLabel[];
  neighbors: RouterNeighborReading[];
}

// MON-200: what a MikroTik hears from the devices around it. Changes nothing
// on the router.
export interface IRouterNeighborReader {
  read(
    connection: RouterPortConnection
  ): Promise<Result<RouterNeighborsReading>>;
}
