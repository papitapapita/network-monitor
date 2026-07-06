import { DomainEvent } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';

interface DeviceWentOfflineEventProps {
  readonly aggregateId: DeviceId;
  readonly consecutiveFailures: number;
  readonly dateTimeOccurred: Date;
}

export class DeviceWentOfflineEvent extends DomainEvent<DeviceWentOfflineEventProps> {
  get aggregateId(): DeviceId {
    return this.props.aggregateId;
  }
  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }
  get consecutiveFailures(): number {
    return this.props.consecutiveFailures;
  }
}
