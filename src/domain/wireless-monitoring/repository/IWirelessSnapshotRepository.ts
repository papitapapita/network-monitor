import { Result } from 'domain/shared/core';
import { DeviceId, SnapshotId } from 'domain/shared/ids';
import { WirelessSnapshot } from '../aggregates/WirelessSnapshot';

// append-only: update and delete are intentionally absent
export interface IWirelessSnapshotRepository {
  save(snapshot: WirelessSnapshot): Promise<Result<WirelessSnapshot>>;
  findById(id: SnapshotId): Promise<Result<WirelessSnapshot | null>>;

  findLatestByDevice(
    deviceId: DeviceId
  ): Promise<Result<WirelessSnapshot | null>>;
  findHistoryByDevice(
    deviceId: DeviceId,
    from: Date,
    to: Date
  ): Promise<Result<WirelessSnapshot[]>>;
}
