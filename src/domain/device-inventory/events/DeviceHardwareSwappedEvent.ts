import { DomainEvent } from 'domain/shared/core';
import { DeviceId, DeviceModelId } from 'domain/shared/ids';
import { MACAddress } from 'domain/shared/value-objects';
import { DeviceHardwareSwappedEventProps } from '../props';
import { DeviceName, SerialNumber } from '../value-objects';

export class DeviceHardwareSwappedEvent extends DomainEvent<DeviceHardwareSwappedEventProps> {
  get aggregateId(): DeviceId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceName(): DeviceName {
    return this.props.deviceName;
  }

  get counterpartDeviceId(): DeviceId {
    return this.props.counterpartDeviceId;
  }

  get previousDeviceModelId(): DeviceModelId {
    return this.props.previousDeviceModelId;
  }

  get newDeviceModelId(): DeviceModelId {
    return this.props.newDeviceModelId;
  }

  get previousSerialNumber(): SerialNumber | null {
    return this.props.previousSerialNumber;
  }

  get newSerialNumber(): SerialNumber | null {
    return this.props.newSerialNumber;
  }

  get previousMacAddress(): MACAddress | null {
    return this.props.previousMacAddress;
  }

  get newMacAddress(): MACAddress | null {
    return this.props.newMacAddress;
  }
}
