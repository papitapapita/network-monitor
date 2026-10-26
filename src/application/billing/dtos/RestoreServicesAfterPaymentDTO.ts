export interface RestoreServicesAfterPaymentRequestDTO {
  // The bill just paid.
  billId: string;
}

export interface RestoreServicesAfterPaymentResultDTO {
  // False when nothing was tried: the cut is off.
  attempted: boolean;
  restored: number;
  failed: { id: string; error: string }[];
}
