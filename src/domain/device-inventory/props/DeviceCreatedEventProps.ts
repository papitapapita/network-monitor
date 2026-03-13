import { DeviceId } from '../../shared/ids';
import { DeviceStatus, DeviceName } from '../value-objects';
import { DeviceOwnerType } from '../enums';
import { IPAddress } from 'domain/shared';

export interface DeviceCreatedEventProps {
  readonly aggregateId: DeviceId;
  readonly deviceName: DeviceName;
  readonly status: DeviceStatus;
  readonly ownerType: DeviceOwnerType;
  readonly monitoringEnabled: boolean;
  readonly ipAddress: IPAddress | null;
  readonly dateTimeOccurred: Date;
}
