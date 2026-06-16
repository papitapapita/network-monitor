import { ContractedServiceResponseDTO } from './ContractedServiceResponseDTO';

export interface ContractedServiceListResponseDTO {
  contractedServices: ContractedServiceResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
