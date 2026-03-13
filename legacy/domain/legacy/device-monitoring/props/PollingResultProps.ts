import {
  NetworkDeviceId,
  PollingStatus,
  PollingMetrics,
  NetworkDeviceStatus
} from '../../device-inventory';

export interface PollingResultProps {
  networkDeviceId: NetworkDeviceId;
  timestamp: Date;
  status: PollingStatus;
  metrics: PollingMetrics | null; // Contains multi-ping statistics
  attemptNumber: number; // 1-10
  errorMessage: string | null;
  deviceStatus: NetworkDeviceStatus; // ONLINE/OFFLINE/MAINTENANCE
}
