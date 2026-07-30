import { DeviceModelId, LocationId } from 'domain/shared/ids';
import { IPAddress, MACAddress } from 'domain/shared/value-objects';
import {
  DeviceName,
  SerialNumber,
  DeviceStatus,
  DeviceCategory
} from '../value-objects';
import { DeviceOwnerType } from '../enums';

// PATCH semantics: an absent key means "leave unchanged", an explicit null
// means "clear". Every field a caller may change in one operation belongs
// here, so Device.applyChanges can judge the whole candidate state at once.
export interface DeviceChanges {
  deviceModelId?: DeviceModelId;
  name?: DeviceName;
  description?: string | null;
  category?: DeviceCategory | null;
  serialNumber?: SerialNumber | null;
  macAddress?: MACAddress | null;
  ipAddress?: IPAddress | null;
  installedDate?: Date | null;
  ownerType?: DeviceOwnerType;
  status?: DeviceStatus;
  locationId?: LocationId | null;
  monitoringEnabled?: boolean;
}
