export interface DeviceBackupStateDTO {
  lastAttemptAt: string | null;
  lastOutcome: string | null;
  lastError: string | null;
  lastSuccessAt: string | null;
  failingSince: string | null;
  consecutiveFailures: number;
}
