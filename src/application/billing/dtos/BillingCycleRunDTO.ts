export interface RunBillingCycleRequestDTO {
  now: Date;
}

export interface BillingCycleRunResultDTO {
  automaticBillingEnabled: boolean;
  generated: number;
  markedOverdue: number;
  failed: { id: string; error: string }[];
}
