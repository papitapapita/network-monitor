import { DomainEvent } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { DeviceDeletedEventProps } from '../props';
import { DeviceName, DeviceStatus } from '../value-objects';

export class DeviceDeletedEvent extends DomainEvent<DeviceDeletedEventProps> {
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

  get deletedBy(): string | null {
    return this.props.deletedBy;
  }

  get deletedAt(): Date {
    return this.props.deletedAt;
  }
}
