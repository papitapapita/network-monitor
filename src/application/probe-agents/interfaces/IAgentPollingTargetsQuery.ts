import { Result } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';

export interface AgentPollingTarget {
  deviceId: string;
  ipAddress: string;
  intervalSeconds: number;
  failuresBeforeDown: number;
}

// Read-only view across inventory (which agent reaches a device) and
// device-monitoring (how to poll it). Returns exactly the devices the
// in-process scheduler would poll if they were not behind an agent.
export interface IAgentPollingTargetsQuery {
  listForAgent(
    agentId: AgentId
  ): Promise<Result<AgentPollingTarget[]>>;
}
