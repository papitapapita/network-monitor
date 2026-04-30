export interface CreateDevicePollingDTO {
  deviceId: string;
  ipAddress?: string | null;
  intervalSeconds?: number;
  failuresBeforeDown?: number;
  enabled?: boolean;
}
