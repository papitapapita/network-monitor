import { DeviceId } from 'domain/shared/ids';
import { DeviceStatus, DeviceName } from '../value-objects';
import { DeviceOwnerType } from '../enums';
import { IPAddress } from 'domain/shared/value-objects';

export interface DeviceCreatedEventProps {
  readonly aggregateId: DeviceId;
  readonly deviceName: DeviceName;
  readonly status: DeviceStatus;
  readonly ownerType: DeviceOwnerType | null;
  readonly monitoringEnabled: boolean;
  readonly ipAddress: IPAddress | null;
  readonly dateTimeOccurred: Date;
}
