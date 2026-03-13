import { Result } from 'domain/shared/core';
import { IPAddress } from 'domain/shared';
import {
  DeviceId,
  LocationId,
  DeviceModelId
} from '../../shared/ids';
import {
  MACAddress,
  DeviceStatus,
  DeviceCategory
} from '../value-objects';
import { DeviceOwnerType } from '../enums';
import { Device } from '../aggregates/Device';

/**
 * Repository interface for the Device aggregate.
 *
 * Responsibilities:
 * - Persist and retrieve physical device assets
 * - Query devices by various domain criteria
 * - Check uniqueness of MAC and IP addresses
 *
 * Implementation Notes:
 * - Must dispatch domain events after a successful save
 * - Business constraint violations (duplicate MAC, duplicate IP) return Result.fail()
 * - Infrastructure failures (connection lost, timeout) throw exceptions
 * - findAll and filtered queries exclude nothing by default — Device has no soft-delete
 */
export interface IDeviceRepository {
  // ============================================================================
  // Basic CRUD
  // ============================================================================

  /**
   * Saves a device (create or update).
   * Dispatches domain events after a successful save.
   *
   * Returns Result.fail() for business constraint violations:
   * - MAC address already in use
   * - IP address already in use
   *
   * @param device - Device to persist
   * @returns Result<Device> - Persisted device or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  save(device: Device): Promise<Result<Device>>;

  /**
   * Finds a device by its unique identifier.
   * Returns null when the device does not exist (valid domain outcome).
   *
   * @param id - DeviceId
   * @returns Result<Device | null>
   * @throws InfrastructureException
   */
  findById(id: DeviceId): Promise<Result<Device | null>>;

  /**
   * Permanently deletes a device by ID.
   *
   * @param id - DeviceId
   * @returns Result<void>
   * @throws InfrastructureException
   */
  delete(id: DeviceId): Promise<Result<void>>;

  /**
   * Checks whether a device with the given ID exists.
   *
   * @param id - DeviceId
   * @returns Result<boolean>
   * @throws InfrastructureException
   */
  exists(id: DeviceId): Promise<Result<boolean>>;

  /**
   * Returns the total number of devices.
   *
   * @returns Result<number>
   * @throws InfrastructureException
   */
  count(): Promise<Result<number>>;

  // ============================================================================
  // Domain Queries
  // ============================================================================

  /**
   * Finds all devices with optional pagination.
   * Returns an empty array when no devices exist (valid domain outcome).
   *
   * @param limit - Maximum number of results
   * @param offset - Number of results to skip
   * @returns Result<Device[]>
   * @throws InfrastructureException
   */
  findAll(limit?: number, offset?: number): Promise<Result<Device[]>>;

  /**
   * Finds all devices assigned to a specific location.
   * Returns an empty array when no devices are assigned there.
   *
   * @param locationId - LocationId
   * @returns Result<Device[]>
   * @throws InfrastructureException
   */
  findByLocation(locationId: LocationId): Promise<Result<Device[]>>;

  /**
   * Finds all devices that use a specific device model.
   * Returns an empty array when no devices use that model.
   *
   * @param deviceModelId - DeviceModelId
   * @returns Result<Device[]>
   * @throws InfrastructureException
   */
  findByDeviceModel(
    deviceModelId: DeviceModelId
  ): Promise<Result<Device[]>>;

  /**
   * Finds a device by its MAC address.
   * MAC addresses are unique per device.
   * Returns null when no device has that MAC.
   *
   * @param macAddress - MACAddress value object
   * @returns Result<Device | null>
   * @throws InfrastructureException
   */
  findByMacAddress(
    macAddress: MACAddress
  ): Promise<Result<Device | null>>;

  /**
   * Finds a device by its IP address.
   * Returns null when no device has that IP.
   *
   * @param ipAddress - IPAddress value object
   * @returns Result<Device | null>
   * @throws InfrastructureException
   */
  findByIpAddress(
    ipAddress: IPAddress
  ): Promise<Result<Device | null>>;

  /**
   * Finds all devices with a specific operational status.
   * Returns an empty array when none match.
   *
   * @param status - DeviceStatus
   * @returns Result<Device[]>
   * @throws InfrastructureException
   */
  findByStatus(status: DeviceStatus): Promise<Result<Device[]>>;

  /**
   * Checks whether a MAC address is already assigned to any device.
   * Used for uniqueness validation before saving.
   *
   * @param macAddress - MACAddress value object
   * @returns Result<boolean> - true if in use
   * @throws InfrastructureException
   */
  existsByMacAddress(
    macAddress: MACAddress
  ): Promise<Result<boolean>>;

  /**
   * Checks whether an IP address is already assigned to any device.
   * Used for uniqueness validation before saving.
   *
   * @param ipAddress - IPAddress value object
   * @returns Result<boolean> - true if in use
   * @throws InfrastructureException
   */
  existsByIpAddress(ipAddress: IPAddress): Promise<Result<boolean>>;

  // ============================================================================
  // Advanced Filtering
  // ============================================================================

  /**
   * Finds devices matching multiple optional filter criteria combined with AND logic.
   * All filter parameters are optional; omitted parameters are ignored.
   *
   * @param filters - Combinable filter criteria
   * @returns Result<Device[]> - Matching devices (may be empty)
   * @throws InfrastructureException
   */
  findByFilters(filters: {
    status?: DeviceStatus;
    category?: DeviceCategory;
    owner?: DeviceOwnerType;
    locationId?: LocationId;
    deviceModelId?: DeviceModelId;
    monitoringEnabled?: boolean;
    search?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'status';
    sortOrder?: 'ASC' | 'DESC';
    limit?: number;
    offset?: number;
  }): Promise<Result<Device[]>>;
}
