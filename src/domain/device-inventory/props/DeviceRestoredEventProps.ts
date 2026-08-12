import { DeviceId } from 'domain/shared/ids';
import { DeviceName, DeviceStatus } from '../value-objects';

export interface DeviceRestoredEventProps {
  readonly aggregateId: DeviceId;
  readonly deviceName: DeviceName;
  readonly status: DeviceStatus;
  readonly deletedAt: Date;
  readonly dateTimeOccurred: Date;
}
