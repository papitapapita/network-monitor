import { UniqueEntityID, Result } from '../core';

export class ServicePlanId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): ServicePlanId {
    return new ServicePlanId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<ServicePlanId> {
    const result = ServicePlanId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new ServicePlanId(result.value));
  }
}
