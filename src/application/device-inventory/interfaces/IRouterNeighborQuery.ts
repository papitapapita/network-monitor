import { Result } from 'domain/shared/core';

// One entry of a MikroTik's neighbour table, heard on one of its ports.
export interface RouterNeighborRow {
  port: string;
  macAddress: string | null;
  ipAddress: string | null;
  identity: string | null;
  platform: string | null;
  board: string | null;
  version: string | null;
  // the neighbour's own interface it announced from
  remoteInterface: string | null;
}

export interface RouterNeighborsRow {
  routerDeviceId: string;
  routerName: string;
  ports: { name: string; comment: string | null }[];
  neighbors: RouterNeighborRow[];
}

export interface UnreadRouterRow {
  deviceId: string;
  name: string;
  reason: string;
}

export interface RouterNeighborsRead {
  routers: RouterNeighborsRow[];
  unreadRouters: UnreadRouterRow[];
}

// What the company's MikroTiks hear around them (device monitoring reads
// them live). Read-only, for discovery, upstream suggestions and port labels.
export interface IRouterNeighborQuery {
  findRouterNeighbors(): Promise<Result<RouterNeighborsRead>>;
  // null when the device is not a MikroTik that can be read for this
  findRouterNeighborsOf(
    deviceId: string
  ): Promise<Result<RouterNeighborsRead | null>>;
}
