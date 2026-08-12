import { DomainEvent } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { DeviceRestoredEventProps } from '../props';
import { DeviceName, DeviceStatus } from '../value-objects';

export class DeviceRestoredEvent extends DomainEvent<DeviceRestoredEventProps> {
  get aggregateId(): DeviceId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceName(): DeviceName {
    return this.props.deviceName;
  }

  get status(): DeviceStatus {
    return this.props.status;
  }

  // When the device had been deleted — not when it came back.
  get deletedAt(): Date {
    return this.props.deletedAt;
  }
}
