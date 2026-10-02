import type { DecryptedCredentials } from './IDeviceCredentialsRepository';
import type { WirelessCollectionResult } from './IWirelessCollector';

export type AgentReadRefusal =
  | 'AGENT_OFFLINE'
  | 'PROBE_UNSUPPORTED'
  | 'TIMEOUT'
  | 'AGENT_ERROR';

export interface AgentRadioReadRequest {
  ipAddress: string;
  vendor: string;
  deviceType: 'STATION' | 'ACCESS_POINT';
  credentials: DecryptedCredentials;
}

export type AgentRadioAnswer =
  | {
      kind: 'measured';
      reading: WirelessCollectionResult;
      measuredAt: Date;
    }
  | { kind: 'refused'; reason: AgentReadRefusal; error: string };

// Reads a radio from the on-site agent it sits behind (WLS-029). The answer
// is already timed on this server's clock.
export interface IAgentRadioReader {
  read(
    agentId: string,
    request: AgentRadioReadRequest
  ): Promise<AgentRadioAnswer>;
}

export const NoAgentRadioReader: IAgentRadioReader = {
  read: async () => ({
    kind: 'refused',
    reason: 'AGENT_OFFLINE',
    error: 'No agent is connected to this server'
  })
};
