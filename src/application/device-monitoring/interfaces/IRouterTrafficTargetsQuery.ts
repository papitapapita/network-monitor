import { Result } from 'domain/shared/core';

// The router's RouterOS API login: the device's HTTP username and password
// on its API port (MON-066).
export interface RouterApiLogin {
  username: string;
  password: string;
  apiPort: number;
}

// A main router as inventory and its stored credentials (decrypted) describe
// it; whether it can be read is decided by resolveRouterTrafficTarget.
export interface RouterTrafficCandidate {
  deviceId: string;
  deviceName: string;
  ipAddress: string | null;
  vendorSlug: string | null;
  agentId: string | null;
  login: RouterApiLogin | null;
}

export interface IRouterTrafficTargetsQuery {
  // MON-060: the in-service GATEWAY devices, by name.
  listMainRouters(): Promise<Result<RouterTrafficCandidate[]>>;
}
