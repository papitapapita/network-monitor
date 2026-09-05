export interface UpdateQuotationDetailsRequestDTO {
  id: string;
  validUntil?: string;
  notes?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
}
