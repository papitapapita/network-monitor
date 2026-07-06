import { UniqueEntityID, Result } from '../core';

export class WirelessDeviceConfigId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): WirelessDeviceConfigId {
    return new WirelessDeviceConfigId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<WirelessDeviceConfigId> {
    const result = WirelessDeviceConfigId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new WirelessDeviceConfigId(result.value));
  }
}
