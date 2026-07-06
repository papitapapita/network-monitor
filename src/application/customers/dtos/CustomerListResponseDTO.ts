import { CustomerResponseDTO } from './CustomerResponseDTO';

export interface CustomerListResponseDTO {
  customers: CustomerResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
