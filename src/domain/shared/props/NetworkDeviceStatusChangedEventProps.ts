import {
  IPAddress,
  NetworkDeviceId,
  NetworkDeviceStatus
} from '../../';

export interface NetworkDeviceStatusChangedEventProps {
  readonly aggregateId: NetworkDeviceId;
  readonly deviceName: string;
  readonly previousStatus: NetworkDeviceStatus;
  readonly newStatus: NetworkDeviceStatus;
  readonly ipAddress: IPAddress;
  readonly dateTimeOccurred: Date;
}
