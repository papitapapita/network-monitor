import { DomainEvent } from '../../shared/core';
import { DeviceId } from '../../shared/ids';
import { DeviceStatusChangedEventProps } from '../props';
import { DeviceStatus, DeviceName } from '../value-objects';

export class DeviceStatusChangedEvent extends DomainEvent<DeviceStatusChangedEventProps> {
  get aggregateId(): DeviceId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceName(): DeviceName {
    return this.props.deviceName;
  }

  get previousStatus(): DeviceStatus {
    return this.props.previousStatus;
  }

  get newStatus(): DeviceStatus {
    return this.props.newStatus;
  }
}
