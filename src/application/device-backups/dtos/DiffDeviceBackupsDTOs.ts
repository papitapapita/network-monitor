import { ConfigBackupDTO } from './ConfigBackupDTO';

export interface DiffDeviceBackupsRequestDTO {
  deviceId: string;
  fromBackupId: string;
  toBackupId: string;
}

export interface ConfigDiffLineDTO {
  kind: 'context' | 'added' | 'removed';
  text: string;
}

export interface ConfigDiffHunkDTO {
  fromStart: number;
  fromLines: number;
  toStart: number;
  toLines: number;
  lines: ConfigDiffLineDTO[];
}

export interface DeviceBackupDiffDTO {
  from: ConfigBackupDTO;
  to: ConfigBackupDTO;
  identical: boolean;
  added: number;
  removed: number;
  hunks: ConfigDiffHunkDTO[];
}
