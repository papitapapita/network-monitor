import { UniqueEntityID, Result } from '../core';

export class SnapshotId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): SnapshotId {
    return new SnapshotId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<SnapshotId> {
    const result = SnapshotId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new SnapshotId(result.value));
  }
}
