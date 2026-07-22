import { UniqueEntityID, Result } from '../core';

export class BillId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): BillId {
    return new BillId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<BillId> {
    const result = BillId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new BillId(result.value));
  }
}
