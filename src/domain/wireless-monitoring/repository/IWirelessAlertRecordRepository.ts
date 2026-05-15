import { Result } from 'domain/shared/core';
import { DeviceId, WirelessAlertRecordId } from 'domain/shared/ids';
import { WirelessAlertRecord } from '../aggregates/WirelessAlertRecord';

/**
 * Repository interface for the WirelessAlertRecord aggregate.
 *
 * Responsibilities:
 * - Persist and update the lifecycle of wireless alert records (open → cleared)
 * - Query active alerts for real-time operational dashboards
 * - Query alert history for reporting and SLA analysis
 *
 * Implementation Notes:
 * - Must dispatch domain events after a successful save (e.g. WirelessAlertClearedEvent)
 * - Infrastructure failures (connection lost, timeout) throw exceptions
 * - "Active" means isActive === true; cleared records are retained for audit history
 * - findActiveByDeviceAndMetric enforces the one-active-alert-per-device-per-metric invariant
 */
export interface IWirelessAlertRecordRepository {
  // ============================================================================
  // Basic CRUD
  // ============================================================================

  /**
   * Saves an alert record (create or update).
   * Dispatches domain events after a successful save.
   *
   * @param record - WirelessAlertRecord to persist
   * @returns Result<WirelessAlertRecord> - Persisted record
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  save(record: WirelessAlertRecord): Promise<Result<WirelessAlertRecord>>;

  /**
   * Finds an alert record by its unique identifier.
   * Returns null when the record does not exist (valid domain outcome).
   *
   * @param id - WirelessAlertRecordId
   * @returns Result<WirelessAlertRecord | null>
   * @throws InfrastructureException
   */
  findById(id: WirelessAlertRecordId): Promise<Result<WirelessAlertRecord | null>>;

  /**
   * Checks whether an alert record exists for the given primary key.
   *
   * @param id - WirelessAlertRecordId
   * @returns Result<boolean>
   * @throws InfrastructureException
   */
  exists(id: WirelessAlertRecordId): Promise<Result<boolean>>;

  // ============================================================================
  // Domain Queries
  // ============================================================================

  /**
   * Finds the currently active alert for a specific device and metric combination.
   * At most one active alert exists per device per metric at any time.
   * Returns null when no active alert exists for that combination.
   *
   * @param deviceId - DeviceId of the target device
   * @param metric - Metric name (e.g. 'signal_strength', 'cpu_load')
   * @returns Result<WirelessAlertRecord | null>
   * @throws InfrastructureException
   */
  findActiveByDeviceAndMetric(
    deviceId: DeviceId,
    metric: string
  ): Promise<Result<WirelessAlertRecord | null>>;

  /**
   * Finds all currently active alerts for a specific device.
   * Returns an empty array when the device has no active alerts.
   *
   * @param deviceId - DeviceId of the target device
   * @returns Result<WirelessAlertRecord[]>
   * @throws InfrastructureException
   */
  findAllActiveByDevice(deviceId: DeviceId): Promise<Result<WirelessAlertRecord[]>>;

  /**
   * Finds all currently active alerts across all devices.
   * Returns an empty array when no active alerts exist system-wide.
   *
   * @returns Result<WirelessAlertRecord[]>
   * @throws InfrastructureException
   */
  findAllActive(): Promise<Result<WirelessAlertRecord[]>>;

  /**
   * Finds all alert records (active and cleared) for a device whose triggeredAt
   * timestamp falls within the inclusive range [from, to].
   * Returns an empty array when no records exist in that range.
   *
   * @param deviceId - DeviceId of the target device
   * @param from - Start of the time range (inclusive)
   * @param to - End of the time range (inclusive)
   * @param limit - Optional maximum number of records to return
   * @returns Result<WirelessAlertRecord[]>
   * @throws InfrastructureException
   */
  findHistoryByDevice(
    deviceId: DeviceId,
    from: Date,
    to: Date,
    limit?: number
  ): Promise<Result<WirelessAlertRecord[]>>;
}
