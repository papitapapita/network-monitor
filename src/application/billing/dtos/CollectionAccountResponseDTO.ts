import { CollectionAccountLineItemDTO } from './CollectionAccountLineItemDTO';

export interface CollectionAccountResponseDTO {
  id: string;
  code: number | null;
  number: string | null;
  status: string;
  customerId: string | null;
  customerName: string;
  customerDocument: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  lineItems: CollectionAccountLineItemDTO[];
  total: number;
  issueDate: string;
  dueDate: string | null;
  notes: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}
