import { VendorResponseDTO } from './VendorResponseDTO';

export interface VendorListResponseDTO {
  vendors: VendorResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
