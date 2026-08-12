import { DeviceId } from 'domain/shared/ids';
import { DeviceName, DeviceStatus } from '../value-objects';

export interface DeviceDeletedEventProps {
  readonly aggregateId: DeviceId;
  readonly deviceName: DeviceName;
  readonly status: DeviceStatus;
  readonly deletedBy: string | null;
  readonly deletedAt: Date;
  readonly dateTimeOccurred: Date;
}
