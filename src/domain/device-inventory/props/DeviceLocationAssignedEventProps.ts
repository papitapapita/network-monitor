import { DeviceId, LocationId } from 'domain/shared/ids';
import { DeviceName } from '../value-objects';

export interface DeviceLocationAssignedEventProps {
  readonly aggregateId: DeviceId;
  readonly deviceName: DeviceName;
  readonly previousLocationId: LocationId | null;
  readonly newLocationId: LocationId | null;
  readonly dateTimeOccurred: Date;
}
