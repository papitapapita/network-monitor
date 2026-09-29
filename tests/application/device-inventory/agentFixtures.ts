import { Result } from '../../../src/domain/shared/core/Result';
import { AgentId } from '../../../src/domain/shared/ids';
import {
  AgentAssignability,
  IAgentAssignmentQuery
} from '../../../src/application/device-inventory/interfaces';
import { AgentAssignmentPolicy } from '../../../src/application/device-inventory/services';

// An in-memory view of probe-agents: ids mapped to whether they are revoked.
export class FakeAgentAssignmentQuery
  implements IAgentAssignmentQuery
{
  readonly agents = new Map<string, 'ASSIGNABLE' | 'REVOKED'>();
  failWith: string | null = null;

  add(status: 'ASSIGNABLE' | 'REVOKED' = 'ASSIGNABLE'): string {
    const id = AgentId.create().toString();
    this.agents.set(id, status);
    return id;
  }

  async check(agentId: AgentId): Promise<Result<AgentAssignability>> {
    if (this.failWith) return Result.fail(this.failWith);
    return Result.ok(
      this.agents.get(agentId.toString()) ?? 'NOT_FOUND'
    );
  }

  async listAssignable(): Promise<Result<AgentId[]>> {
    if (this.failWith) return Result.fail(this.failWith);
    return Result.ok(
      [...this.agents]
        .filter(([, status]) => status === 'ASSIGNABLE')
        .map(([id]) => AgentId.parse(id).value)
    );
  }
}

export function makeAgentPolicy(): {
  agents: FakeAgentAssignmentQuery;
  policy: AgentAssignmentPolicy;
} {
  const agents = new FakeAgentAssignmentQuery();
  return { agents, policy: new AgentAssignmentPolicy(agents) };
}
