import { BillResponseDTO } from './BillResponseDTO';

export interface BillListResponseDTO {
  bills: BillResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
