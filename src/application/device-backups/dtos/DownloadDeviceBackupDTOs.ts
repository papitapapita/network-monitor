export interface DownloadDeviceBackupRequestDTO {
  deviceId: string;
  backupId: string;
}

export interface DeviceBackupFileDTO {
  fileName: string;
  contentType: string;
  content: string;
}
