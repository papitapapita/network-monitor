import { QuotationLineItemDTO } from './QuotationLineItemDTO';

export interface QuotationResponseDTO {
  id: string;
  code: number | null;
  status: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  lineItems: QuotationLineItemDTO[];
  subtotal: number;
  total: number;
  validUntil: string;
  notes: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  expiredAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}
