import { UniqueEntityID, Result } from '../core';

export class ContractedServiceId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): ContractedServiceId {
    return new ContractedServiceId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<ContractedServiceId> {
    const result = ContractedServiceId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new ContractedServiceId(result.value));
  }
}
