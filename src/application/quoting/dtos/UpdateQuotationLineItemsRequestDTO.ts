import { QuotationLineItemRequestDTO } from './QuotationLineItemDTO';

export interface UpdateQuotationLineItemsRequestDTO {
  id: string;
  lineItems: QuotationLineItemRequestDTO[];
}
