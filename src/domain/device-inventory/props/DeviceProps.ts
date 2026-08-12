import {
  DeviceId,
  DeviceModelId,
  LocationId
} from 'domain/shared/ids';
import { IPAddress, MACAddress } from 'domain/shared/value-objects';
import {
  DeviceName,
  SerialNumber,
  DeviceStatus,
  DeviceCategory
} from '../value-objects';
import { DeviceOwnerType } from '../enums';

export interface DeviceProps {
  // References (by ID — no cross-aggregate object references)
  deviceModelId: DeviceModelId;
  locationId: LocationId | null;

  // Classification
  status: DeviceStatus;
  category: DeviceCategory | null;
  ownerType: DeviceOwnerType | null;

  // Identity
  name: DeviceName;
  serialNumber: SerialNumber | null;
  macAddress: MACAddress | null;
  ipAddress: IPAddress | null;
  description: string | null;

  // Lifecycle
  installedDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;

  // Replacement lineage. Only replacesDeviceId is stored; replacedByDeviceId
  // is read back off the unique index on it, so the two cannot disagree.
  replacedAt: Date | null;
  replacesDeviceId: DeviceId | null;
  replacedByDeviceId: DeviceId | null;

  // Monitoring
  monitoringEnabled: boolean;
}
