import { UniqueEntityID, Result } from '../core';

export class TechnicianId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): TechnicianId {
    return new TechnicianId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<TechnicianId> {
    const result = TechnicianId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new TechnicianId(result.value));
  }
}
