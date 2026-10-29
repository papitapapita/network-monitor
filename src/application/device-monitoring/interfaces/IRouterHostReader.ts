import { Result } from 'domain/shared/core';
import { RouterPortConnection } from './IRouterPortReader';
import { RouterPortLabel } from './IRouterNeighborReader';

// One MAC a MikroTik's bridge has learned, and the port it came in on.
export interface RouterBridgeHost {
  macAddress: string;
  port: string;
  // one of the router's own MACs
  local: boolean;
}

export interface RouterArpEntry {
  ipAddress: string;
  macAddress: string;
  interface: string | null;
}

export interface RouterDhcpLease {
  ipAddress: string;
  macAddress: string;
  hostname: string | null;
}

// Each table is null when the router refused it: a router with no DHCP
// server, or a user without the right to read it.
export interface RouterHostsReading {
  ports: RouterPortLabel[];
  bridgeHosts: RouterBridgeHost[] | null;
  arp: RouterArpEntry[] | null;
  leases: RouterDhcpLease[] | null;
}

// MON-202: who a MikroTik sees behind its ports and at which address.
// Changes nothing on the router.
export interface IRouterHostReader {
  read(
    connection: RouterPortConnection
  ): Promise<Result<RouterHostsReading>>;
}
