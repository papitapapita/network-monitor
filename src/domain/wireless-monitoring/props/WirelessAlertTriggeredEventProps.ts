import { SnapshotId, DeviceId } from 'domain/shared/ids';
import { WirelessAlert } from '../value-objects';

export interface WirelessAlertTriggeredEventProps {
  readonly aggregateId: SnapshotId;
  readonly deviceId: DeviceId;
  readonly alerts: ReadonlyArray<WirelessAlert>;
  readonly dateTimeOccurred: Date;
}
