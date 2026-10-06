import { BillLineItemDTO } from './BillLineItemDTO';
import { BillPaymentDTO } from './BillPaymentDTO';

export interface BillResponseDTO {
  id: string;
  customerId: string;
  period: string;
  status: string;
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  // Null until paid, and on bills marked paid before payments were kept.
  payment: BillPaymentDTO | null;
  total: number;
  lineItems: BillLineItemDTO[];
  createdAt: string;
  updatedAt: string;
}
