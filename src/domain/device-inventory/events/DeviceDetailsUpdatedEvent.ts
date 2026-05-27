import { DomainEvent } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { DeviceDetailsUpdatedEventProps } from '../props';
import { DeviceName } from '../value-objects';

export class DeviceDetailsUpdatedEvent extends DomainEvent<DeviceDetailsUpdatedEventProps> {
  get aggregateId(): DeviceId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceName(): DeviceName {
    return this.props.deviceName;
  }

  get updatedFields(): DeviceDetailsUpdatedEventProps['updatedFields'] {
    return this.props.updatedFields;
  }
}
