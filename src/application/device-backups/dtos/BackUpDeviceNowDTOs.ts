import { ConfigBackupDTO } from './ConfigBackupDTO';

export interface BackUpDeviceNowRequestDTO {
  deviceId: string;
}

export interface BackUpDeviceNowResponseDTO {
  outcome: 'SAVED' | 'UNCHANGED';
  backup: ConfigBackupDTO;
}
