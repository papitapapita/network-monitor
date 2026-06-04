import { DomainEvent } from 'domain/shared/core';
import { WirelessDeviceConfigId, DeviceId } from 'domain/shared/ids';
import { WirelessDeviceConfigToggledEventProps } from '../props';

export class WirelessDeviceConfigToggledEvent extends DomainEvent<WirelessDeviceConfigToggledEventProps> {
  get aggregateId(): WirelessDeviceConfigId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceId(): DeviceId {
    return this.props.deviceId;
  }

  get enabled(): boolean {
    return this.props.enabled;
  }
}
