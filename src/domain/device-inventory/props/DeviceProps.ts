import { DeviceModelId, LocationId } from 'domain/shared/ids';
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

  // Monitoring
  monitoringEnabled: boolean;
}
