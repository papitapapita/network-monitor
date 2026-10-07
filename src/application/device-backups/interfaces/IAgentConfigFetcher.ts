import type {
  BackupCredentials,
  BackupDeviceKind
} from './IBackupTargetsQuery';
import type { FetchedConfig } from './IConfigFetcher';

export type AgentBackupRefusal =
  | 'AGENT_OFFLINE'
  | 'PROBE_UNSUPPORTED'
  | 'TIMEOUT'
  | 'AGENT_ERROR';

export interface AgentConfigFetchRequest {
  ipAddress: string;
  vendorSlug: string;
  kind: BackupDeviceKind;
  credentials: BackupCredentials;
}

export type AgentConfigAnswer =
  | { kind: 'fetched'; config: FetchedConfig }
  | { kind: 'refused'; reason: AgentBackupRefusal; error: string };

// Reads a device's configuration through the on-site agent it sits behind
// (BKP-016), with the same fetchers this server would use.
export interface IAgentConfigFetcher {
  fetch(
    agentId: string,
    request: AgentConfigFetchRequest
  ): Promise<AgentConfigAnswer>;
}

export const NoAgentConfigFetcher: IAgentConfigFetcher = {
  fetch: async () => ({
    kind: 'refused',
    reason: 'AGENT_OFFLINE',
    error: 'No agent is connected to this server'
  })
};
