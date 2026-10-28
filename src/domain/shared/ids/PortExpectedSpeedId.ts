import { UniqueEntityID, Result } from '../core';

export class PortExpectedSpeedId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): PortExpectedSpeedId {
    return new PortExpectedSpeedId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<PortExpectedSpeedId> {
    const result = PortExpectedSpeedId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new PortExpectedSpeedId(result.value));
  }
}
