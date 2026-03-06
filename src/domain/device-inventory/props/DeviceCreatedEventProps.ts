import { DeviceId } from '../../shared/ids';
import { DeviceStatus, DeviceName } from '../value-objects';
import { DeviceOwnerType } from '../enums';

export interface DeviceCreatedEventProps {
  readonly aggregateId: DeviceId;
  readonly deviceName: DeviceName;
  readonly status: DeviceStatus;
  readonly ownerType: DeviceOwnerType;
  readonly dateTimeOccurred: Date;
}
