export interface ConfigBackupDTO {
  id: string;
  deviceId: string;
  format: string;
  sizeBytes: number;
  trigger: string;
  takenAt: string;
  lastCheckedAt: string;
}
