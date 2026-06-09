import { UniqueEntityID, Result } from '../core';

export class UserId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): UserId {
    return new UserId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<UserId> {
    const result = UserId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new UserId(result.value));
  }
}
