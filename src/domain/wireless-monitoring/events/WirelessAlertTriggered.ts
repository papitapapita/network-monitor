import { DomainEvent } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { SnapshotId } from 'domain/shared/ids';
import { WirelessAlert } from '../value-objects/WirelessAlert';
import { WirelessAlertTriggeredEventProps } from '../props';

/**
 * WirelessAlertTriggeredEvent - One or more wireless metric thresholds were breached in a snapshot.
 *
 * Published By: WirelessSnapshot aggregate
 * Published When: WirelessSnapshot.create() is called and at least one alert is present
 *
 * Handlers:
 * - WirelessAlertTriggeredHandler: Opens WirelessAlertRecord entries for each alert
 */
export class WirelessAlertTriggeredEvent extends DomainEvent<WirelessAlertTriggeredEventProps> {
  constructor(props: WirelessAlertTriggeredEventProps) {
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

  get alerts(): ReadonlyArray<WirelessAlert> {
    return this.props.alerts;
  }
}
