import { UniqueEntityID, Result } from '../core';

export class ConfigBackupId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): ConfigBackupId {
    return new ConfigBackupId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<ConfigBackupId> {
    const result = ConfigBackupId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new ConfigBackupId(result.value));
  }
}
