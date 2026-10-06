export interface RunBillingCycleRequestDTO {
  now: Date;
}

export interface BillingCycleRunResultDTO {
  automaticBillingEnabled: boolean;
  generated: number;
  markedOverdue: number;
  // Customers whose services the run suspended (BIL-310).
  cut: number;
  failed: { id: string; error: string }[];
}
