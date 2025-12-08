import {
  NetworkDeviceType,
  NetworkDeviceStatus,
  IPAddress,
  MACAddress,
  ConnectivityType,
  ManagementProtocol,
  PollingConfiguration
} from '../..';

export interface NetworkDeviceProps {
  name: string;
  deviceType: NetworkDeviceType;
  status: NetworkDeviceStatus;
  description: string | null;
  installDate: Date;
  ipAddress: IPAddress;
  macAddress: MACAddress;
  connectivityType: ConnectivityType;
  managementProtocol: ManagementProtocol;
  managementPort: number;
  enabledRemoteAccess: boolean;
  deviceId: string; // Reference to Device entity
  pollingConfiguration: PollingConfiguration; // Polling configuration entity
  createdAt: Date;
  updatedAt: Date;
}
