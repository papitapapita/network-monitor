import { Result } from 'domain/shared/core';
import { UnreadRouterRow } from './IRouterNeighborQuery';

export interface RouterBridgeHostRow {
  macAddress: string;
  port: string;
  // one of the router's own MACs
  local: boolean;
}

export interface RouterArpRow {
  ipAddress: string;
  macAddress: string;
}

export interface RouterLeaseRow {
  ipAddress: string;
  macAddress: string;
  hostname: string | null;
}

// A table is null when the router refused it.
export interface RouterHostsRow {
  routerDeviceId: string;
  routerName: string;
  ports: { name: string; comment: string | null }[];
  bridgeHosts: RouterBridgeHostRow[] | null;
  arp: RouterArpRow[] | null;
  leases: RouterLeaseRow[] | null;
}

export interface RouterHostsRead {
  routers: RouterHostsRow[];
  unreadRouters: UnreadRouterRow[];
}

// Who the company's MikroTiks see behind their ports and at which address
// (device monitoring reads them live). Read-only, for locating a device,
// discovery and the address check.
export interface IRouterHostQuery {
  findRouterHosts(): Promise<Result<RouterHostsRead>>;
}
