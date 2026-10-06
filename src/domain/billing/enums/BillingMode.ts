// Which month a bill pays for (BIL-282): the month its due date falls in
// (paid in advance) or the month before it (paid after use).
export enum BillingMode {
  ADVANCE = 'ADVANCE',
  ARREARS = 'ARREARS'
}
