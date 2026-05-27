import { AggregateRoot } from 'domain/shared/core';
import { DeviceId, SnapshotId } from 'domain/shared/ids';
import { WirelessSnapshotProps } from '../props';
import {
  WirelessMetrics,
  WirelessClientEntry,
  WirelessAlert
} from '../value-objects';
import {
  WirelessSnapshotCreatedEvent,
  WirelessAlertTriggeredEvent
} from '../events';

export class WirelessSnapshot extends AggregateRoot<
  WirelessSnapshotProps,
  SnapshotId
> {
  private constructor(props: WirelessSnapshotProps, id: SnapshotId) {
    super(props, id);
  }

  get snapshotId(): SnapshotId {
    return this.id;
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
  get collectionMethod(): 'snmp' | 'http_api' | 'mixed' {
    return this.props.collectionMethod;
  }
  get metrics(): WirelessMetrics {
    return this.props.metrics;
  }
  get clients(): WirelessClientEntry[] {
    return [...this.props.clients];
  }
  get alerts(): WirelessAlert[] {
    return [...this.props.alerts];
  }

  // no creation invariants — props are validated upstream by the collector pipeline
  public static create(
    props: WirelessSnapshotProps,
    id?: SnapshotId
  ): WirelessSnapshot {
    const snapshotId = id ?? SnapshotId.create();
    const snapshot = new WirelessSnapshot(props, snapshotId);

    snapshot.addDomainEvent(
      new WirelessSnapshotCreatedEvent({
        aggregateId: snapshotId,
        deviceId: props.deviceId,
        deviceType: props.deviceType,
        collectedAt: props.collectedAt,
        dateTimeOccurred: new Date()
      })
    );

    if (props.alerts.length > 0) {
      snapshot.addDomainEvent(
        new WirelessAlertTriggeredEvent({
          aggregateId: snapshotId,
          deviceId: props.deviceId,
          alerts: props.alerts,
          dateTimeOccurred: new Date()
        })
      );
    }

    return snapshot;
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: SnapshotId,
    props: WirelessSnapshotProps
  ): WirelessSnapshot {
    return new WirelessSnapshot(props, id);
  }
}
