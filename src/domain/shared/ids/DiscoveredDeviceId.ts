import { UniqueEntityID, Result } from '../core';

export class DiscoveredDeviceId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): DiscoveredDeviceId {
    return new DiscoveredDeviceId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<DiscoveredDeviceId> {
    const result = DiscoveredDeviceId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new DiscoveredDeviceId(result.value));
  }
}
