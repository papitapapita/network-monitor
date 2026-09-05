import { QuotationResponseDTO } from './QuotationResponseDTO';

export interface QuotationListResponseDTO {
  quotations: QuotationResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
