import { Result } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';

// Read-only count across inventory: how many live devices sit behind each
// agent (AGT-010). An agent with none is absent from the map.
export interface IAgentDeviceCountQuery {
  countByAgent(
    agentIds: AgentId[]
  ): Promise<Result<Map<string, number>>>;
}
