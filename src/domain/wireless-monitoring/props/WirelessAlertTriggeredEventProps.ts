import { SnapshotId } from 'domain/shared/ids';
import { DeviceId } from 'domain/shared';
import { WirelessAlert } from '../value-objects/WirelessAlert';

export interface WirelessAlertTriggeredEventProps {
  readonly aggregateId: SnapshotId;
  readonly deviceId: DeviceId;
  readonly alerts: ReadonlyArray<WirelessAlert>;
  readonly dateTimeOccurred: Date;
}
