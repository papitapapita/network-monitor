export interface MarkBillPaidRequestDTO {
  id: string;
  method: string;
  reference?: string | null;
  // Defaults to the bill's total; anything else is refused (BIL-301).
  amount?: number;
  // ISO 8601; defaults to now. Never in the future (BIL-302).
  paidAt?: string;
  // The signed-in user entering it.
  recordedByUserId?: string;
}
