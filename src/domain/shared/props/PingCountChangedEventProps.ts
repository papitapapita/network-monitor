import { PollingConfigurationId, NetworkDeviceId } from '../../';

export interface PingCountChangedEventProps {
  readonly aggregateId: NetworkDeviceId;
  readonly pollingConfigurationId: PollingConfigurationId;
  readonly previousPingCount: number;
  readonly newPingCount: number;
  readonly deviceName: string;
  readonly dateTimeOccurred: Date;
}
