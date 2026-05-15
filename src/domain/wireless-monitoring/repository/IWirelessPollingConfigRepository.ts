import { Result } from 'domain/shared/core';
import { DeviceId, WirelessPollingConfigId } from 'domain/shared/ids';
import { WirelessPollingConfig } from '../entities/WirelessPollingConfig';

/**
 * Repository interface for the WirelessPollingConfig aggregate.
 *
 * Responsibilities:
 * - Persist and retrieve polling configuration for wireless devices
 * - Query configs that are currently due for a polling cycle
 * - Enforce the one-config-per-device invariant
 *
 * Implementation Notes:
 * - Must dispatch domain events after a successful save (e.g. WirelessPollingConfigToggledEvent)
 * - Constraint violations (duplicate deviceId) return Result.fail()
 * - Infrastructure failures (connection lost, timeout) throw exceptions
 * - There is at most one WirelessPollingConfig per DeviceId; findByDeviceId returns null when absent
 */
export interface IWirelessPollingConfigRepository {
  // ============================================================================
  // Basic CRUD
  // ============================================================================

  /**
   * Saves a polling config (create or update).
   * Dispatches domain events after a successful save.
   *
   * Returns Result.fail() for business constraint violations:
   * - A config for the same DeviceId already exists (on create)
   *
   * @param config - WirelessPollingConfig to persist
   * @returns Result<WirelessPollingConfig> - Persisted config or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  save(config: WirelessPollingConfig): Promise<Result<WirelessPollingConfig>>;

  /**
   * Finds a polling config by its unique identifier.
   * Returns null when the config does not exist (valid domain outcome).
   *
   * @param id - WirelessPollingConfigId
   * @returns Result<WirelessPollingConfig | null>
   * @throws InfrastructureException
   */
  findById(id: WirelessPollingConfigId): Promise<Result<WirelessPollingConfig | null>>;

  /**
   * Permanently deletes the polling config for a device.
   * No-op when no config exists for the given DeviceId.
   *
   * @param deviceId - DeviceId of the owning device
   * @returns Result<void>
   * @throws InfrastructureException
   */
  delete(deviceId: DeviceId): Promise<Result<void>>;

  /**
   * Checks whether a polling config exists for the given primary key.
   *
   * @param id - WirelessPollingConfigId
   * @returns Result<boolean>
   * @throws InfrastructureException
   */
  exists(id: WirelessPollingConfigId): Promise<Result<boolean>>;

  // ============================================================================
  // Domain Queries
  // ============================================================================

  /**
   * Finds the polling config associated with a specific device.
   * There is at most one config per device.
   * Returns null when no config has been registered for that device.
   *
   * @param deviceId - DeviceId of the owning device
   * @returns Result<WirelessPollingConfig | null>
   * @throws InfrastructureException
   */
  findByDeviceId(deviceId: DeviceId): Promise<Result<WirelessPollingConfig | null>>;

  /**
   * Finds all enabled configs whose next scheduled poll time is at or before `now`.
   * Used by the polling scheduler to determine which devices to poll on each tick.
   * Returns an empty array when no configs are currently due.
   *
   * @param now - Current timestamp to evaluate polling due dates against
   * @returns Result<WirelessPollingConfig[]>
   * @throws InfrastructureException
   */
  findAllDue(now: Date): Promise<Result<WirelessPollingConfig[]>>;
}
