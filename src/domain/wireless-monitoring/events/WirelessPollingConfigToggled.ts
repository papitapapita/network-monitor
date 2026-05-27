import { DomainEvent } from 'domain/shared/core';
import { WirelessPollingConfigId, DeviceId } from 'domain/shared/ids';
import { WirelessPollingConfigToggledEventProps } from '../props';

export class WirelessPollingConfigToggledEvent extends DomainEvent<WirelessPollingConfigToggledEventProps> {
  get aggregateId(): WirelessPollingConfigId {
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
