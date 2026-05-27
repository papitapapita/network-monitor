import { SnapshotId, DeviceId } from 'domain/shared/ids';

export interface WirelessSnapshotCreatedEventProps {
  readonly aggregateId: SnapshotId;
  readonly deviceId: DeviceId;
  readonly deviceType: 'STATION' | 'ACCESS_POINT';
  readonly collectedAt: Date;
  readonly dateTimeOccurred: Date;
}
