import {
  NetworkDeviceType,
  NetworkDeviceStatus,
  IPAddress,
  MACAddress,
  ConnectivityType,
  ManagementProtocol,
  PollingConfiguration,
  NetworkDeviceId,
  ActivationStatus
} from '..';

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

  // REQ-002: Activation workflow - Draft/Active states
  activationStatus: ActivationStatus; // DRAFT (IP+MAC only) or ACTIVE (fully configured)
  activatedAt: Date | null; // When device was activated
  activatedBy: string | null; // User ID who activated the device

  // REQ-002: Soft delete with 7-day grace period
  deletedAt: Date | null; // Soft delete timestamp
  deletedBy: string | null; // User ID who deleted the device

  // REQ-002: Device replacement tracking
  replacedByDeviceId: NetworkDeviceId | null; // Link to replacement device
  replacedAt: Date | null; // When replacement occurred

  createdAt: Date;
  updatedAt: Date;
}
