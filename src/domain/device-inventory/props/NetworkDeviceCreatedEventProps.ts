import { IPAddress, MACAddress, NetworkDeviceId } from '..';

export interface NetworkDeviceCreatedEventProps {
  readonly aggregateId: NetworkDeviceId;
  readonly deviceName: string;
  readonly ipAddress: IPAddress;
  readonly macAddress: MACAddress;
  readonly dateTimeOccurred: Date;
}
