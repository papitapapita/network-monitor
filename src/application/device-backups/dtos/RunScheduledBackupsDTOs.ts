export interface RunScheduledBackupsRequestDTO {
  now: Date;
}

export interface ScheduledBackupFailureDTO {
  deviceId: string;
  deviceName: string;
  error: string;
}

export interface ScheduledBackupRunDTO {
  saved: number;
  unchanged: number;
  skipped: number;
  failed: ScheduledBackupFailureDTO[];
}
