export interface PollingConfigurationDTO {
  id: string;
  deviceId: string;
  ipAddress: string | null;
  intervalSeconds: number;
  failuresBeforeDown: number;
  enabled: boolean;
}
