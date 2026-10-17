import type {
  DecryptedCredentials,
  WirelessCollectionResult
} from 'application/wireless-monitoring/interfaces';
import type {
  AgentConfigFetchRequest,
  FetchedConfig
} from 'application/device-backups/interfaces';
import type {
  InterfaceTrafficReading,
  RouterConnectionTarget
} from 'application/device-monitoring/interfaces';
import { AgentPingOutcome } from './IAgentPingResultSink';

export type AgentProbeFailureReason =
  // No live connection to the agent.
  | 'AGENT_OFFLINE'
  // Connected, but running a version that does not answer this request.
  | 'PROBE_UNSUPPORTED'
  | 'TIMEOUT'
  // The agent answered with an error: a radio that refused, "busy", ...
  | 'AGENT_ERROR';

export interface AgentProbeFailure {
  ok: false;
  reason: AgentProbeFailureReason;
  error: string;
}

export type AgentProbeOutcome<T> =
  | {
      ok: true;
      reading: T;
      // On the backend's clock, between asking and the answer (AGT-104).
      measuredAt: Date;
    }
  | AgentProbeFailure;

export interface AgentRadioRequest {
  ipAddress: string;
  vendor: string;
  deviceType: 'STATION' | 'ACCESS_POINT';
  credentials: DecryptedCredentials;
}

// Asks a connected agent to measure one device now (AGT-103). The radio
// types are the wireless context's own: the agent runs its collectors, so a
// reading through an agent is the reading the server would have taken.
export interface IAgentProbeChannel {
  ping(
    agentId: string,
    ipAddress: string,
    attempts: number
  ): Promise<AgentProbeOutcome<AgentPingOutcome>>;

  readRadio(
    agentId: string,
    request: AgentRadioRequest
  ): Promise<AgentProbeOutcome<WirelessCollectionResult>>;

  // AGT-113: only an agent that names `backup` is asked.
  fetchConfig(
    agentId: string,
    request: AgentConfigFetchRequest
  ): Promise<AgentProbeOutcome<FetchedConfig>>;

  // AGT-116: only an agent that names `traffic` is asked.
  readTraffic(
    agentId: string,
    router: RouterConnectionTarget
  ): Promise<AgentProbeOutcome<InterfaceTrafficReading[]>>;

  // AGT-119: only an agent that names `sweep` is asked. One reading per
  // address, in the same order.
  sweep(
    agentId: string,
    ipAddresses: string[],
    attempts: number
  ): Promise<AgentProbeOutcome<AgentPingOutcome[]>>;
}
