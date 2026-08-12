import { DomainEvent } from 'domain/shared/core';
import { DeviceId, DeviceModelId } from 'domain/shared/ids';
import { IPAddress } from 'domain/shared/value-objects';
import { DeviceReplacedEventProps } from '../props';
import { DeviceName, DeviceStatus } from '../value-objects';

export class DeviceReplacedEvent extends DomainEvent<DeviceReplacedEventProps> {
  get aggregateId(): DeviceId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceName(): DeviceName {
    return this.props.deviceName;
  }

  get retiredStatus(): DeviceStatus {
    return this.props.retiredStatus;
  }

  get previousDeviceModelId(): DeviceModelId {
    return this.props.previousDeviceModelId;
  }

  get releasedIpAddress(): IPAddress | null {
    return this.props.releasedIpAddress;
  }

  get replacedAt(): Date {
    return this.props.replacedAt;
  }
}
