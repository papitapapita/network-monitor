import { UniqueEntityID, Result } from '../core';

export class WirelessPollingConfigId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): WirelessPollingConfigId {
    return new WirelessPollingConfigId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<WirelessPollingConfigId> {
    const result = WirelessPollingConfigId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new WirelessPollingConfigId(result.value));
  }
}
