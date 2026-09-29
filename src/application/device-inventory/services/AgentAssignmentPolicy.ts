import { Result } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';
import { IAgentAssignmentQuery } from '../interfaces';

export const AGENT_CHOICE_REQUIRED =
  'agentId is required when more than one agent exists — choose which one reaches this device';

// Which agent a device is placed behind. Existence and revocation are checked
// here, not in the Device aggregate, because they are facts about another
// context (ADR 0002, "Placement in the architecture").
export class AgentAssignmentPolicy {
  constructor(private readonly agents: IAgentAssignmentQuery) {}

  // An explicit id, from a create, an update or a bulk move.
  async resolve(rawAgentId: string): Promise<Result<AgentId>> {
    const idResult = AgentId.parse(rawAgentId.trim());
    if (idResult.isFailure) {
      return Result.fail(`Invalid agentId: ${idResult.error}`);
    }

    const checkResult = await this.agents.check(idResult.value);
    if (checkResult.isFailure) {
      return Result.fail(
        `Failed to verify agent: ${checkResult.error}`
      );
    }
    switch (checkResult.value) {
      case 'NOT_FOUND':
        return Result.fail(`Agent not found: ${rawAgentId.trim()}`);
      case 'REVOKED':
        return Result.fail(
          `Agent ${rawAgentId.trim()} is revoked and cannot take devices`
        );
      case 'ASSIGNABLE':
        return Result.ok(idResult.value);
    }
  }

  // A new device: undefined means "the caller did not say". With no agent
  // the device is polled in-process; with exactly one it goes there; with
  // several the caller must choose, so nothing lands silently where no
  // agent will ever poll it. An explicit null keeps it in-process.
  async resolveForNewDevice(
    rawAgentId: string | null | undefined
  ): Promise<Result<AgentId | null>> {
    if (rawAgentId === null) return Result.ok(null);
    if (rawAgentId !== undefined) return this.resolve(rawAgentId);

    const listResult = await this.agents.listAssignable();
    if (listResult.isFailure) {
      return Result.fail(
        `Failed to list agents: ${listResult.error}`
      );
    }
    const assignable = listResult.value;
    if (assignable.length === 0) return Result.ok(null);
    if (assignable.length === 1) return Result.ok(assignable[0]);
    return Result.fail(AGENT_CHOICE_REQUIRED);
  }
}
