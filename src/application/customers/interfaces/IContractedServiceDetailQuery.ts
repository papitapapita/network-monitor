import { Result } from 'domain/shared/core';
import {
  ContractedServiceId,
  CustomerId,
  DeviceId
} from 'domain/shared/ids';
import { ContractedServiceDetailDTO } from '../dtos';

export interface ContractedServiceDetailCriteria {
  customerId?: CustomerId;
  deviceId?: DeviceId;
  limit?: number;
  offset?: number;
}

/**
 * Read side of the contracted-service screens. The device summary belongs to
 * device-inventory, so the join lives here for display only and returns DTOs,
 * never a ContractedService aggregate.
 */
export interface IContractedServiceDetailQuery {
  findById(
    id: ContractedServiceId
  ): Promise<Result<ContractedServiceDetailDTO | null>>;
  list(
    criteria: ContractedServiceDetailCriteria
  ): Promise<Result<ContractedServiceDetailDTO[]>>;
  count(
    criteria: ContractedServiceDetailCriteria
  ): Promise<Result<number>>;
}
