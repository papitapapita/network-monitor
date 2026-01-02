import {
  PollingConfigurationId,
  NetworkDeviceId,
  PollingInterval
} from '../../';

export interface PollingIntervalChangedEventProps {
  readonly aggregateId: NetworkDeviceId;
  readonly pollingConfigurationId: PollingConfigurationId;
  readonly previousInterval: PollingInterval;
  readonly newInterval: PollingInterval;
  readonly deviceName: string;
  readonly dateTimeOccurred: Date;
}
