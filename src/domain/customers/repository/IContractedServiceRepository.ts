import {
  ContractedServiceId,
  CustomerId,
  ServicePlanId,
  DeviceId
} from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { ContractedService } from '../aggregates';

export interface IContractedServiceRepository {
  save(
    service: ContractedService
  ): Promise<Result<ContractedService>>;
  findById(
    id: ContractedServiceId
  ): Promise<Result<ContractedService | null>>;
  findByCustomerId(
    customerId: CustomerId
  ): Promise<Result<ContractedService[]>>;
  findByServicePlanId(
    servicePlanId: ServicePlanId
  ): Promise<Result<ContractedService[]>>;
  findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<ContractedService | null>>;
  findAll(
    limit?: number,
    offset?: number
  ): Promise<Result<ContractedService[]>>;
  delete(id: ContractedServiceId): Promise<Result<void>>;
  exists(id: ContractedServiceId): Promise<Result<boolean>>;
  count(): Promise<Result<number>>;
}
