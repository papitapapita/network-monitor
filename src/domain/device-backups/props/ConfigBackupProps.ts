import { DeviceId } from 'domain/shared/ids';
import { BackupFormat, BackupTrigger } from '../enums';

export interface ConfigBackupProps {
  deviceId: DeviceId;
  format: BackupFormat;
  contentHash: string;
  sizeBytes: number;
  trigger: BackupTrigger;
  takenAt: Date;
  lastCheckedAt: Date;
}
