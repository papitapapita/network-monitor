import { DomainEvent } from 'domain/shared/core';
import { DeviceId, DeviceModelId } from 'domain/shared/ids';
import { DeviceModelCorrectedEventProps } from '../props';
import { DeviceName } from '../value-objects';

export class DeviceModelCorrectedEvent extends DomainEvent<DeviceModelCorrectedEventProps> {
  get aggregateId(): DeviceId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceName(): DeviceName {
    return this.props.deviceName;
  }

  get previousDeviceModelId(): DeviceModelId {
    return this.props.previousDeviceModelId;
  }

  get newDeviceModelId(): DeviceModelId {
    return this.props.newDeviceModelId;
  }
}
