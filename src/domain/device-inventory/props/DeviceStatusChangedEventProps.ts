import { DeviceId } from 'domain/shared/ids';
import { DeviceStatus, DeviceName } from '../value-objects';

export interface DeviceStatusChangedEventProps {
  readonly aggregateId: DeviceId;
  readonly deviceName: DeviceName;
  readonly previousStatus: DeviceStatus;
  readonly newStatus: DeviceStatus;
  readonly dateTimeOccurred: Date;
}
