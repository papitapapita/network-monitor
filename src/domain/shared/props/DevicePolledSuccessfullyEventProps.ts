import {
  PollingResultId,
  NetworkDeviceId,
  PollingMetrics,
  IPAddress
} from '../../';

export interface DevicePolledSuccessfullyEventProps {
  readonly aggregateId: PollingResultId;
  readonly networkDeviceId: NetworkDeviceId;
  readonly deviceName: string;
  readonly ipAddress: IPAddress;
  readonly metrics: PollingMetrics;
  readonly wasOffline: boolean; // True if this is recovery from offline state
  readonly dateTimeOccurred: Date;
}
