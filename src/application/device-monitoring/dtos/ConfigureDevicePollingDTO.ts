export interface ConfigureDevicePollingDTO {
  deviceId: string;
  intervalSeconds?: number;
  failuresBeforeDown?: number;
  enabled?: boolean;
}
