export interface RestoreServicesAfterPaymentRequestDTO {
  customerId: string;
}

export interface RestoreServicesAfterPaymentResultDTO {
  // False when nothing was tried: the cut is off or a bill is still overdue.
  attempted: boolean;
  restored: number;
  failed: { id: string; error: string }[];
}
