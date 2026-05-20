import { DomainEvent } from '../../shared/core';
import { DeviceId, LocationId } from '../../shared/ids';
import { DeviceLocationAssignedEventProps } from '../props';
import { DeviceName } from '../value-objects';

export class DeviceLocationAssignedEvent extends DomainEvent<DeviceLocationAssignedEventProps> {
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
