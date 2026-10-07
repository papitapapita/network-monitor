import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';

// The device's login: the HTTP username and password, used over HTTP by
// AirOS and over SSH by RouterOS (BKP-055).
export interface BackupCredentials {
  username: string;
  password: string;
  httpPort: number;
  sshPort: number;
}

// The main devices whose configuration is backed up (BKP-010).
export type BackupDeviceKind = 'ACCESS_POINT' | 'ROUTER' | 'SWITCH';

// Who reads the device's configuration (BKP-015, BKP-016). On site this
// server does; off site, the agent the device sits behind, if any.
export type BackupReach =
  | { by: 'server' }
  | { by: 'agent'; agentId: string }
  | { by: 'none' };

// What the backup context needs to know about a device, read from inventory,
// wireless monitoring and the stored credentials (decrypted).
export interface BackupCandidate {
  deviceId: string;
  deviceName: string;
  ipAddress: string | null;
  vendorSlug: string | null;
  // null: not a main device, such as a station or a server.
  kind: BackupDeviceKind | null;
  reach: BackupReach;
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
