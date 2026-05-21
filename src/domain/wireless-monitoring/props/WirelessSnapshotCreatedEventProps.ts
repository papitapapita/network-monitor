import { SnapshotId } from 'domain/shared/ids';
import { DeviceId } from 'domain/shared';

export interface WirelessSnapshotCreatedEventProps {
  readonly aggregateId: SnapshotId;
  readonly deviceId: DeviceId;
  readonly deviceType: 'STATION' | 'ACCESS_POINT';
  readonly collectedAt: Date;
  readonly dateTimeOccurred: Date;
}
