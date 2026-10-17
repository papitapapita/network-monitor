import { Result } from 'domain/shared/core';

export interface RouterConnectionTarget {
  host: string;
  port: number;
  username: string;
  password: string;
  // The agent the router sits behind, if any; off site it is read through
  // that agent (MON-065).
  agentId: string | null;
}

export interface InterfaceTrafficReading {
  name: string;
  type: string;
  running: boolean;
  rxBps: number;
  txBps: number;
}

// The router's current rate on each of its static, enabled interfaces
// (MON-063), as RouterOS itself computes it.
export interface IRouterTrafficReader {
  read(
    router: RouterConnectionTarget
  ): Promise<Result<InterfaceTrafficReading[]>>;
  // Nobody is watching any more: close every router login (MON-064).
  releaseAll(): Promise<void>;
}
