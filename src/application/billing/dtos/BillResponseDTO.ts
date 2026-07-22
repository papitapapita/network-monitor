import { BillLineItemDTO } from './BillLineItemDTO';

export interface BillResponseDTO {
  id: string;
  customerId: string;
  period: string;
  status: string;
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  total: number;
  lineItems: BillLineItemDTO[];
  createdAt: string;
  updatedAt: string;
}
