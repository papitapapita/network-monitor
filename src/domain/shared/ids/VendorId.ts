import { UniqueEntityID, Result } from '../core';

export class VendorId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): VendorId {
    return new VendorId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<VendorId> {
    const result = VendorId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new VendorId(result.value));
  }
}
