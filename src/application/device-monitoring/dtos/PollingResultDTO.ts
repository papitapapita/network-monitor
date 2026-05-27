import { PollingMetricsDTO } from './PollingMetricsDTO';

export interface PollingResultDTO {
  id: string;
  deviceId: string;
  timestamp: Date;
  status: 'SUCCESS' | 'FAILED';
  metrics: PollingMetricsDTO | null;
  deviceStatus: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
}
