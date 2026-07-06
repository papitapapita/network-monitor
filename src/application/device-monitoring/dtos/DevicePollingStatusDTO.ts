import { PollingResultDTO } from './PollingResultDTO';

export interface DevicePollingStatusDTO {
  deviceId: string;
  pollingEnabled: boolean;
  intervalSeconds: number;
  failuresBeforeDown: number;
  lastPolled: Date | null;
  // Projected as lastPolled + intervalSeconds; null when never polled.
  nextScheduled: Date | null;
  currentStatus: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  lastResult: PollingResultDTO | null;
  consecutiveFailures: number;
}
