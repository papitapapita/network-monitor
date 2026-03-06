import { DomainEvent } from '../../shared/core';
import { DeviceId, LocationId } from '../../shared/ids';
import { DeviceLocationAssignedEventProps } from '../props';
import { DeviceName } from '../value-objects';

/**
 * DeviceLocationAssignedEvent - The physical location of a device has been set or changed.
 *
 * Published By: Device aggregate
 * Published When: Device.assignLocation() is called with a new or null location
 *
 * Handlers:
 * - NetworkTopologyHandler: Updates network topology maps when device moves
 * - AuditLogHandler: Records the location change for audit trail
 *
 * Use Cases:
 * - AssignDeviceLocationUseCase
 * - UpdateDeviceUseCase
 */
export class DeviceLocationAssignedEvent extends DomainEvent<DeviceLocationAssignedEventProps> {
  constructor(props: DeviceLocationAssignedEventProps) {
    super(props);
  }

  get aggregateId(): DeviceId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceName(): DeviceName {
    return this.props.deviceName;
  }

  get previousLocationId(): LocationId | null {
    return this.props.previousLocationId;
  }

  get newLocationId(): LocationId | null {
    return this.props.newLocationId;
  }
}
