import { UniqueEntityID, Result } from '../core';

export class BankAccountId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): BankAccountId {
    return new BankAccountId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<BankAccountId> {
    const result = BankAccountId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new BankAccountId(result.value));
  }
}
