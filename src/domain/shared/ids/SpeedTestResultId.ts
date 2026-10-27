import { UniqueEntityID, Result } from '../core';

export class SpeedTestResultId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): SpeedTestResultId {
    return new SpeedTestResultId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<SpeedTestResultId> {
    const result = SpeedTestResultId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new SpeedTestResultId(result.value));
  }
}
