import { QuotationLineItemRequestDTO } from './QuotationLineItemDTO';

export interface CreateQuotationRequestDTO {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  validUntil: string;
  notes?: string;
  lineItems: QuotationLineItemRequestDTO[];
  createdBy?: string;
}
