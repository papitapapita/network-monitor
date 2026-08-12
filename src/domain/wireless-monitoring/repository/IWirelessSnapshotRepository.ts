import { Result } from 'domain/shared/core';
import { DeviceId, SnapshotId } from 'domain/shared/ids';
import { WirelessSnapshot } from '../aggregates';

// append-only: update and delete are intentionally absent from the write path
export interface IWirelessSnapshotRepository {
  save(snapshot: WirelessSnapshot): Promise<Result<WirelessSnapshot>>;
  findById(id: SnapshotId): Promise<Result<WirelessSnapshot | null>>;

  findLatestByDevice(
    deviceId: DeviceId
  ): Promise<Result<WirelessSnapshot | null>>;
  // one row per device — the fleet-wide live view, not a paged listing
  findLatestForAllDevices(): Promise<Result<WirelessSnapshot[]>>;
  findHistoryByDevice(
    deviceId: DeviceId,
    from: Date,
    to: Date
  ): Promise<Result<WirelessSnapshot[]>>;

  deleteOlderThan(cutoff: Date): Promise<Result<number>>;
}
