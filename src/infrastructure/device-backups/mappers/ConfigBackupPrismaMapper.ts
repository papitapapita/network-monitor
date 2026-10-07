import {
  ConfigBackup as PrismaConfigBackup,
  DeviceBackupState as PrismaDeviceBackupState
} from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { ConfigBackupId, DeviceId } from 'domain/shared/ids';
import {
  BackupFormat,
  BackupOutcome,
  BackupTrigger,
  ConfigBackup,
  DeviceBackupState
} from 'domain/device-backups';

export class ConfigBackupPrismaMapper {
  static toDomain(
    raw: Omit<PrismaConfigBackup, 'encryptedContent'>
  ): Result<ConfigBackup> {
    const id = ConfigBackupId.parse(raw.id);
    if (id.isFailure)
      return Result.fail(`Invalid backup ID: ${id.error}`);
    const deviceId = DeviceId.parse(raw.deviceId);
    if (deviceId.isFailure)
      return Result.fail(`Invalid device ID: ${deviceId.error}`);
    return Result.ok(
      ConfigBackup.reconstitute(id.value, {
        deviceId: deviceId.value,
        format: raw.format as BackupFormat,
        contentHash: raw.contentHash,
        sizeBytes: raw.sizeBytes,
        trigger: raw.trigger as BackupTrigger,
        takenAt: raw.takenAt,
        lastCheckedAt: raw.lastCheckedAt
      })
    );
  }

  static toPersistence(
    backup: ConfigBackup
  ): Omit<PrismaConfigBackup, 'encryptedContent'> {
    return {
      id: backup.id.toString(),
      deviceId: backup.deviceId.toString(),
      format: backup.format,
      contentHash: backup.contentHash,
      sizeBytes: backup.sizeBytes,
      trigger: backup.trigger,
      takenAt: backup.takenAt,
      lastCheckedAt: backup.lastCheckedAt
    };
  }

  static stateToDomain(
    raw: PrismaDeviceBackupState
  ): Result<DeviceBackupState> {
    const deviceId = DeviceId.parse(raw.deviceId);
    if (deviceId.isFailure)
      return Result.fail(`Invalid device ID: ${deviceId.error}`);
    return Result.ok(
      DeviceBackupState.reconstitute(deviceId.value, {
        lastAttemptAt: raw.lastAttemptAt,
        lastOutcome: raw.lastOutcome as BackupOutcome | null,
        lastError: raw.lastError,
        lastSuccessAt: raw.lastSuccessAt,
        failingSince: raw.failingSince,
        consecutiveFailures: raw.consecutiveFailures
      })
    );
  }

  static stateToPersistence(
    state: DeviceBackupState
  ): Omit<PrismaDeviceBackupState, 'updatedAt'> {
    return {
      deviceId: state.deviceId.toString(),
      lastAttemptAt: state.lastAttemptAt,
      lastOutcome: state.lastOutcome,
      lastError: state.lastError,
      lastSuccessAt: state.lastSuccessAt,
      failingSince: state.failingSince,
      consecutiveFailures: state.consecutiveFailures
    };
  }
}
