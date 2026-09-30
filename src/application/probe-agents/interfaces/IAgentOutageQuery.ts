import { Result } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';
import { AgentOutageDTO } from '../dtos';

// Read side of the outage history the agent repository writes (AGT-026),
// newest first.
export interface IAgentOutageQuery {
  list(
    agentId: AgentId,
    page: { limit: number; offset: number }
  ): Promise<Result<{ outages: AgentOutageDTO[]; total: number }>>;
}
