import { DomainEvent } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { WirelessAlertRecordId } from 'domain/shared/ids';
import { WirelessAlertClearedEventProps } from '../props';

/**
 * WirelessAlertClearedEvent - A wireless metric alert has returned to a healthy state and been cleared.
 *
 * Published By: WirelessAlertRecord aggregate
 * Published When: WirelessAlertRecord.clear() is called successfully
 *
 * Handlers:
 * - WirelessAlertClearedHandler: Marks the alert record as resolved and notifies operators
 */
export class WirelessAlertClearedEvent extends DomainEvent<WirelessAlertClearedEventProps> {
  constructor(props: WirelessAlertClearedEventProps) {
    super(props);
  }

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
