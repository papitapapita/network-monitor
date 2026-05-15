import { DomainEvent } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { SnapshotId } from 'domain/shared/ids';
import { WirelessSnapshotCreatedEventProps } from '../props';

/**
 * WirelessSnapshotCreatedEvent - A wireless metrics snapshot has been collected for a device.
 *
 * Published By: WirelessSnapshot aggregate
 * Published When: WirelessSnapshot.create() is called
 *
 * Handlers:
 * - WirelessSnapshotCreatedHandler: Persists the snapshot and triggers downstream analysis
 */
export class WirelessSnapshotCreatedEvent extends DomainEvent<WirelessSnapshotCreatedEventProps> {
  constructor(props: WirelessSnapshotCreatedEventProps) {
    super(props);
  }

  get aggregateId(): SnapshotId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceId(): DeviceId {
    return this.props.deviceId;
  }

  get deviceType(): 'CPE' | 'ACCESS_POINT' {
    return this.props.deviceType;
  }

  get collectedAt(): Date {
    return this.props.collectedAt;
  }
}
