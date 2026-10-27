import { Result } from 'domain/shared/core';

export interface PingToolAgent {
  id: string;
  name: string;
}

// The probe-agents context's agents, read only to name the one a ping is
// sent from (MON-121).
export interface IPingToolAgentQuery {
  // null when there is no enrolled, unrevoked agent with that id
  findActive(agentId: string): Promise<Result<PingToolAgent | null>>;
}
