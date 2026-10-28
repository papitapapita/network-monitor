import { Result } from 'domain/shared/core';

export interface AgentScannedHost {
  ipAddress: string;
  // null when the host is behind a router from the agent's PC.
  macAddress: string | null;
  latencyMs: number | null;
}

// Scans a segment from the probe agent that sits on it (DEV-214), without
// inventory knowing how agents are reached.
export interface IAgentHostDiscovery {
  discover(
    agentId: string,
    cidr: string
  ): Promise<Result<AgentScannedHost[]>>;
}
