import { DomainEvent } from 'domain/shared/core';
import { DeviceId, SnapshotId } from 'domain/shared/ids';
import { WirelessAlert } from '../value-objects';
import { WirelessAlertTriggeredEventProps } from '../props';

export class WirelessAlertTriggeredEvent extends DomainEvent<WirelessAlertTriggeredEventProps> {
  get aggregateId(): SnapshotId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceId(): DeviceId {
    return this.props.deviceId;
  }

  get alerts(): ReadonlyArray<WirelessAlert> {
    return this.props.alerts;
  }
}
