import {
  PollingConfigurationId,
  NetworkDeviceId
} from '../../device-inventory';

export interface PollingConfigurationChangedEventProps {
  readonly aggregateId: NetworkDeviceId;
  readonly pollingConfigurationId: PollingConfigurationId;
  readonly deviceName: string;
  readonly changeDescription: string;
  readonly dateTimeOccurred: Date;
}
