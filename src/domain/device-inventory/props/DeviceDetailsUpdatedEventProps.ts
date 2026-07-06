import { DeviceId } from 'domain/shared/ids';
import { IPAddress, MACAddress } from 'domain/shared';
import { DeviceName, DeviceCategory } from '../value-objects';
import { DeviceOwnerType } from '../enums';

export interface DeviceDetailsUpdatedEventProps {
  readonly aggregateId: DeviceId;
  readonly deviceName: DeviceName;
  readonly updatedFields: {
    readonly name?: DeviceName;
    readonly description?: string | null;
    readonly category?: DeviceCategory | null;
    readonly serialNumber?: string | null;
    readonly macAddress?: MACAddress | null;
    readonly ipAddress?: IPAddress | null;
    readonly installedDate?: Date | null;
    readonly ownerType?: DeviceOwnerType;
  };
  readonly dateTimeOccurred: Date;
}
