import { UniqueEntityID, Result } from '../core';

export class CollectionAccountId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): CollectionAccountId {
    return new CollectionAccountId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<CollectionAccountId> {
    const result = CollectionAccountId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new CollectionAccountId(result.value));
  }
}
