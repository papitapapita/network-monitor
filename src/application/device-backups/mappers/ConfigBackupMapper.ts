import {
  ConfigBackup,
  DeviceBackupState
} from 'domain/device-backups';
import { ConfigBackupDTO, DeviceBackupStateDTO } from '../dtos';

export class ConfigBackupMapper {
  static toDTO(backup: ConfigBackup): ConfigBackupDTO {
    return {
      id: backup.id.toString(),
      deviceId: backup.deviceId.toString(),
      format: backup.format,
      sizeBytes: backup.sizeBytes,
      trigger: backup.trigger,
      takenAt: backup.takenAt.toISOString(),
      lastCheckedAt: backup.lastCheckedAt.toISOString()
    };
  }

  static stateToDTO(state: DeviceBackupState): DeviceBackupStateDTO {
    return {
      lastAttemptAt: state.lastAttemptAt?.toISOString() ?? null,
      lastOutcome: state.lastOutcome,
      lastError: state.lastError,
      lastSuccessAt: state.lastSuccessAt?.toISOString() ?? null,
      failingSince: state.failingSince?.toISOString() ?? null,
      consecutiveFailures: state.consecutiveFailures
    };
  }
}
