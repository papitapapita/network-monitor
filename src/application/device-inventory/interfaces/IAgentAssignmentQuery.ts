import { Result } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';

export type AgentAssignability =
  | 'ASSIGNABLE'
  | 'REVOKED'
  | 'NOT_FOUND';

// Read-only view of probe-agents, so inventory can place a device behind an
// agent without importing that context (ADR 0002). Assignable means not
// revoked: a pending agent can take devices before its installer runs.
export interface IAgentAssignmentQuery {
  check(agentId: AgentId): Promise<Result<AgentAssignability>>;
  listAssignable(): Promise<Result<AgentId[]>>;
}

// For an install that runs no agents, and for callers wired without the
// real query: nothing is ever assignable, so every device stays in-process.
export const NoAgentsQuery: IAgentAssignmentQuery = {
  async check() {
    return Result.ok<AgentAssignability>('NOT_FOUND');
  },
  async listAssignable() {
    return Result.ok<AgentId[]>([]);
  }
};
