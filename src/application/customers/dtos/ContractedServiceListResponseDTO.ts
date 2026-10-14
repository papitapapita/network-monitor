import { ContractedServiceDetailDTO } from './ContractedServiceDetailDTO';

export interface ContractedServiceListResponseDTO {
  contractedServices: ContractedServiceDetailDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
