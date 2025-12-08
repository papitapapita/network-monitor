import { NetworkDeviceId, PollingInterval, RetryPolicy } from '../..';

export interface PollingConfigurationProps {
  networkDeviceId: NetworkDeviceId;
  interval: PollingInterval;
  enabled: boolean;
  retryPolicy: RetryPolicy;
  pingCount: number; // Number of ICMP pings per poll (1-10)
  lastScheduledAt: Date | null;
  nextScheduledAt: Date | null;
}
