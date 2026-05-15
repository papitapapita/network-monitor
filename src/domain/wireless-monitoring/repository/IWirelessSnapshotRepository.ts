import { Result } from 'domain/shared/core';
import { DeviceId, SnapshotId } from 'domain/shared/ids';
import { WirelessSnapshot } from '../aggregates/WirelessSnapshot';

/**
 * Repository interface for the WirelessSnapshot aggregate.
 *
 * Responsibilities:
 * - Persist immutable snapshots produced by each polling cycle
 * - Retrieve the most recent snapshot for a device (operational view)
 * - Retrieve historical snapshots for a device within a time range (reporting)
 *
 * Implementation Notes:
 * - Must dispatch domain events after a successful save
 *   (WirelessSnapshotCreatedEvent, and WirelessAlertTriggeredEvent when alerts are present)
 * - Snapshots are append-only records; no update or delete operations are exposed
 * - Infrastructure failures (connection lost, timeout) throw exceptions
 */
export interface IWirelessSnapshotRepository {
  // ============================================================================
  // Basic CRUD
  // ============================================================================

  /**
   * Persists a new snapshot.
   * Dispatches domain events after a successful save.
   *
   * Snapshots are immutable once created; this method only creates, never updates.
   *
   * @param snapshot - WirelessSnapshot to persist
   * @returns Result<WirelessSnapshot> - Persisted snapshot
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  save(snapshot: WirelessSnapshot): Promise<Result<WirelessSnapshot>>;

  /**
   * Finds a snapshot by its unique identifier.
   * Returns null when the snapshot does not exist (valid domain outcome).
   *
   * @param id - SnapshotId
   * @returns Result<WirelessSnapshot | null>
   * @throws InfrastructureException
   */
  findById(id: SnapshotId): Promise<Result<WirelessSnapshot | null>>;

  // ============================================================================
  // Domain Queries
  // ============================================================================

  /**
   * Finds the most recently collected snapshot for a device.
   * Returns null when no snapshots have been recorded for that device.
   *
   * @param deviceId - DeviceId of the target device
   * @returns Result<WirelessSnapshot | null>
   * @throws InfrastructureException
   */
  findLatestByDevice(deviceId: DeviceId): Promise<Result<WirelessSnapshot | null>>;

  /**
   * Finds all snapshots for a device whose collectedAt timestamp falls
   * within the inclusive range [from, to].
   * Returns an empty array when no snapshots exist in that range.
   *
   * @param deviceId - DeviceId of the target device
   * @param from - Start of the time range (inclusive)
   * @param to - End of the time range (inclusive)
   * @returns Result<WirelessSnapshot[]>
   * @throws InfrastructureException
   */
  findHistoryByDevice(
    deviceId: DeviceId,
    from: Date,
    to: Date
  ): Promise<Result<WirelessSnapshot[]>>;
}
