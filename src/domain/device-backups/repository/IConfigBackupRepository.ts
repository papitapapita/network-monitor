import { Result } from 'domain/shared/core';
import { ConfigBackupId, DeviceId } from 'domain/shared/ids';
import { ConfigBackup } from '../aggregates';

export interface IConfigBackupRepository {
  // A new version together with the file the device sent.
  add(backup: ConfigBackup, content: string): Promise<Result<void>>;
  save(backup: ConfigBackup): Promise<Result<void>>;
  findById(id: ConfigBackupId): Promise<Result<ConfigBackup | null>>;
  findLatestByDevice(
    deviceId: DeviceId
  ): Promise<Result<ConfigBackup | null>>;
  // Newest first.
  listByDevice(deviceId: DeviceId): Promise<Result<ConfigBackup[]>>;
  findContent(id: ConfigBackupId): Promise<Result<string | null>>;
  // Removes all but the newest `keep` versions; returns how many went.
  pruneOldVersions(
    deviceId: DeviceId,
    keep: number
  ): Promise<Result<number>>;
}
