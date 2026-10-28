import { Result } from 'domain/shared/core';
import { RouterApiLogin } from './IRouterTrafficTargetsQuery';

export interface RouterPortConnection {
  host: string;
  login: RouterApiLogin;
  // The agent the router sits behind, if any; off site it is read through
  // that agent (MON-145).
  agentId: string | null;
}

export interface EthernetPortReading {
  name: string;
  comment: string | null;
  linked: boolean;
  // null when the router did not say, or not in a rate it knows
  rateMbps: number | null;
  fullDuplex: boolean | null;
  // MON-190: cumulative since the counters were last reset; null when the
  // router did not say (an agent before 0.11.0 never does)
  rxErrors: number | null;
  linkDowns: number | null;
  // null on a port with no fibre module
  sfp: SfpReading | null;
}

// MON-190: each figure null when the module does not report it.
export interface SfpReading {
  rxPowerDbm: number | null;
  txPowerDbm: number | null;
  temperatureC: number | null;
}

export interface RouterPortsReading {
  // the router's own name (`/system identity`)
  identity: string | null;
  ports: EthernetPortReading[];
}

// MON-141: a MikroTik's enabled Ethernet ports and what each negotiated,
// read once over the RouterOS API, with their error counters and fibre
// module readings (MON-190). Changes nothing on the router.
export interface IRouterPortReader {
  read(
    connection: RouterPortConnection
  ): Promise<Result<RouterPortsReading>>;
}
