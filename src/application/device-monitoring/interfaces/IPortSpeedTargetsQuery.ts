import { Result } from 'domain/shared/core';
import { RouterApiLogin } from './IRouterTrafficTargetsQuery';

// Who reads the router (MON-145). On site this server does; off site, the
// agent the router sits behind, which cannot read ports yet.
export type PortSpeedReach =
  | { by: 'server' }
  | { by: 'agent'; agentId: string }
  | { by: 'none' };

// A MikroTik as inventory and its stored credentials (decrypted) describe
// it; whether it can be read is decided by resolvePortSpeedTarget.
export interface PortSpeedRouterCandidate {
  deviceId: string;
  deviceName: string;
  ipAddress: string | null;
  reach: PortSpeedReach;
  login: RouterApiLogin | null;
}

export interface IPortSpeedTargetsQuery {
  // MON-140: the company's MikroTik routers and switches in service, by name.
  listRouters(): Promise<Result<PortSpeedRouterCandidate[]>>;
  // null when the device is not one of those.
  findRouter(
    deviceId: string
  ): Promise<Result<PortSpeedRouterCandidate | null>>;
}
