import { PollingMetricsDTO } from './PollingMetricsDTO';

export interface SingleDevicePollingResultDTO {
  deviceId: string;
  // SKIPPED when polling is disabled and forceExecution was false.
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  message: string;
  timestamp: Date;
  metrics: PollingMetricsDTO | null;
  deviceStatus: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
}
