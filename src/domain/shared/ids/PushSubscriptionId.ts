import { UniqueEntityID, Result } from '../core';

export class PushSubscriptionId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): PushSubscriptionId {
    return new PushSubscriptionId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<PushSubscriptionId> {
    const result = PushSubscriptionId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new PushSubscriptionId(result.value));
  }
}
