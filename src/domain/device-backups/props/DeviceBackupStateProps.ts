import { BackupOutcome } from '../enums';

export interface DeviceBackupStateProps {
  lastAttemptAt: Date | null;
  lastOutcome: BackupOutcome | null;
  lastError: string | null;
  lastSuccessAt: Date | null;
  failingSince: Date | null;
  consecutiveFailures: number;
}
