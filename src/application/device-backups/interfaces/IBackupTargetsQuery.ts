import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';

export interface BackupCredentials {
  username: string;
  password: string;
  port: number;
}

// What the backup context needs to know about a device, read from inventory,
// wireless monitoring and the stored credentials (decrypted).
export interface BackupCandidate {
  deviceId: string;
  deviceName: string;
  ipAddress: string | null;
  vendorSlug: string | null;
  isAccessPoint: boolean;
  // Whether this server can open a connection to the device itself.
  reachable: boolean;
  credentials: BackupCredentials | null;
}

export interface IBackupTargetsQuery {
  // The devices the daily run backs up (BKP-010).
  listScheduled(): Promise<Result<BackupCandidate[]>>;
  // null when the device does not exist or was deleted.
  findByDevice(
    deviceId: DeviceId
  ): Promise<Result<BackupCandidate | null>>;
}
