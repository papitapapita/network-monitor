import { ServicePlanId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { ServicePlan } from '../aggregates';

export interface IServicePlanRepository {
  save(plan: ServicePlan): Promise<Result<ServicePlan>>;
  findById(id: ServicePlanId): Promise<Result<ServicePlan | null>>;
  findByName(name: string): Promise<Result<ServicePlan | null>>;
  findAll(
    limit?: number,
    offset?: number
  ): Promise<Result<ServicePlan[]>>;
  delete(id: ServicePlanId): Promise<Result<void>>;
  exists(id: ServicePlanId): Promise<Result<boolean>>;
  count(): Promise<Result<number>>;
}
