import {
  IPAddress,
  MACAddress,
  NetworkDeviceId
} from '../../device-inventory';

export interface NetworkDeviceDeletedEventProps {
  readonly aggregateId: NetworkDeviceId;
  readonly deviceName: string;
  readonly ipAddress: IPAddress;
  readonly macAddress: MACAddress;
  readonly deletedBy?: string; // Optional: who requested deletion
  readonly dateTimeOccurred: Date;
}
