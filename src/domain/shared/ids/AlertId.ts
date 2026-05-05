import { UniqueEntityID, Result } from '../core';

export class AlertId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): AlertId {
    return new AlertId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<AlertId> {
    const result = AlertId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new AlertId(result.value));
  }
}
