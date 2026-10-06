export interface BillPaymentDTO {
  method: string;
  reference: string | null;
  amount: number;
  paidAt: string;
  recordedByUserId: string | null;
}
