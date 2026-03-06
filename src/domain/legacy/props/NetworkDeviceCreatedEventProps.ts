import {
  IPAddress,
  MACAddress,
  NetworkDeviceId
} from '../../device-inventory';

export interface NetworkDeviceCreatedEventProps {
  readonly aggregateId: NetworkDeviceId;
  readonly deviceName: string;
  readonly ipAddress: IPAddress;
  readonly macAddress: MACAddress;
  readonly dateTimeOccurred: Date;
}
