import { ConfigBackupDTO } from './ConfigBackupDTO';
import { DeviceBackupStateDTO } from './DeviceBackupStateDTO';

export interface ListDeviceBackupsRequestDTO {
  deviceId: string;
}

export interface DeviceBackupsResponseDTO {
  deviceId: string;
  state: DeviceBackupStateDTO | null;
  backups: ConfigBackupDTO[];
}
