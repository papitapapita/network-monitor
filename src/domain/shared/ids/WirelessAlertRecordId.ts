import { UniqueEntityID, Result } from '../core';

export class WirelessAlertRecordId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): WirelessAlertRecordId {
    return new WirelessAlertRecordId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<WirelessAlertRecordId> {
    const result = WirelessAlertRecordId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new WirelessAlertRecordId(result.value));
  }
}
