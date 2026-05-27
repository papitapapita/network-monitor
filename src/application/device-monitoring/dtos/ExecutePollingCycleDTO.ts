export interface ExecutePollingCycleDTO {
  deviceId: string;
  // When true, polls even if polling is disabled. For manual on-demand checks.
  forceExecution?: boolean;
}
