export interface RunBillingCycleRequestDTO {
  now: Date;
}

export interface BillingCycleRunResultDTO {
  automaticBillingEnabled: boolean;
  generated: number;
  markedOverdue: number;
  // Customers whose services the run suspended (BIL-310).
  cut: number;
  // Bills reminded today (BIL-321) and issued bills emailed (BIL-320).
  reminded: number;
  emailed: number;
  failed: { id: string; error: string }[];
}
