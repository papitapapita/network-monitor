import { UniqueEntityID, Result } from '../core';

export class CustomerId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): CustomerId {
    return new CustomerId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<CustomerId> {
    const result = CustomerId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new CustomerId(result.value));
  }
}
