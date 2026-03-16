import { DomainEvent } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';

interface DeviceCameOnlineEventProps {
  readonly aggregateId: DeviceId;
  readonly latencyMs: number | null;
  readonly dateTimeOccurred: Date;
}

export class DeviceCameOnlineEvent extends DomainEvent<DeviceCameOnlineEventProps> {
  get aggregateId(): DeviceId    { return this.props.aggregateId; }
  get dateTimeOccurred(): Date   { return this.props.dateTimeOccurred; }
  get latencyMs(): number | null { return this.props.latencyMs; }
}
