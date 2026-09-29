import { UniqueEntityID, Result } from '../core';

export class AgentId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): AgentId {
    return new AgentId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<AgentId> {
    const result = AgentId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new AgentId(result.value));
  }
}
