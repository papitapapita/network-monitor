import { UniqueEntityID, Result } from '../core';

export class MutedAlertTypeId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): MutedAlertTypeId {
    return new MutedAlertTypeId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<MutedAlertTypeId> {
    const result = MutedAlertTypeId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new MutedAlertTypeId(result.value));
  }
}
