import { DomainEvent } from 'domain/shared/core';
import { DeviceId, WirelessAlertRecordId } from 'domain/shared/ids';
import { WirelessAlertClearedEventProps } from '../props';

export class WirelessAlertClearedEvent extends DomainEvent<WirelessAlertClearedEventProps> {
  get aggregateId(): WirelessAlertRecordId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceId(): DeviceId {
    return this.props.deviceId;
  }

  get metric(): string {
    return this.props.metric;
  }

  get severity(): 'WARNING' | 'CRITICAL' {
    return this.props.severity;
  }

  get clearedAt(): Date {
    return this.props.clearedAt;
  }
}
