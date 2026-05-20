import { DomainEvent } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { SnapshotId } from 'domain/shared/ids';
import { WirelessSnapshotCreatedEventProps } from '../props';

export class WirelessSnapshotCreatedEvent extends DomainEvent<WirelessSnapshotCreatedEventProps> {
  get aggregateId(): SnapshotId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceId(): DeviceId {
    return this.props.deviceId;
  }

  get deviceType(): 'STATION' | 'ACCESS_POINT' {
    return this.props.deviceType;
  }

  get collectedAt(): Date {
    return this.props.collectedAt;
  }
}
