import { UniqueEntityID, Result } from '../core';

export class QuotationId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): QuotationId {
    return new QuotationId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<QuotationId> {
    const result = QuotationId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new QuotationId(result.value));
  }
}
