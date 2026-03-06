import {
  NetworkDevice,
  NetworkDeviceId,
  IPAddress,
  Result,
  MACAddress,
  NetworkDeviceStatus,
  ActivationStatus,
  NetworkDeviceType
} from '..';

/**
 * Repository interface for NetworkDevice aggregate.
 *
 * Responsibilities:
 * - Persist and retrieve network devices
 * - Query devices by IP, MAC, status, activation status
 * - Support soft delete with grace period (7 days)
 * - Handle device replacement workflows
 * - Provide bulk operations for batch processing
 * - Check uniqueness of IP and MAC addresses
 *
 * Implementation Notes:
 * - Must load device WITH polling configuration (entire aggregate)
 * - Must dispatch domain events after successful save
 * - Must handle unique constraint violations (IP, MAC) as business errors
 * - Existing query methods (findById, findAll, etc.) exclude soft-deleted devices by default
 * - Soft-deleted devices have deletedAt !== null
 * - Business errors (duplicates, constraint violations) return Result.fail()
 * - Infrastructure errors (connection lost, timeouts) throw exceptions
 *
 * REQ-002: CRUD Operations with Draft/Active States
 * - Supports ActivationStatus filtering (DRAFT, ACTIVE)
 * - Soft delete: devices marked for deletion remain queryable via dedicated methods
 * - Device replacement: detect recently deleted devices by IP for replacement workflow
 * - Bulk operations: saveMany, deleteMany for batch processing
 * - Advanced filtering: findByFilters with multiple criteria
 *
 * @see REQ-002 Network Device CRUD Operations
 */
export interface INetworkDeviceRepository {
  // ========== Basic CRUD Operations ==========

  /**
   * Saves a network device (create or update).
   * Loads entire aggregate including PollingConfiguration.
   * Dispatches domain events after successful save.
   *
   * Returns Result.fail() for business constraint violations:
   * - IP address already exists (unique constraint)
   * - MAC address already exists (unique constraint)
   * - Foreign key violations
   *
   * @param device - Network device to save
   * @returns Result<NetworkDevice> - Saved device or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures (connection lost, timeout, etc.)
   */
  save(device: NetworkDevice): Promise<Result<NetworkDevice>>;

  /**
   * Finds a device by its unique identifier.
   * Excludes soft-deleted devices (deletedAt !== null).
   * Returns null if not found (valid scenario, not an error).
   *
   * @param id - Device ID
   * @returns Result<NetworkDevice | null> - Device, null, or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  findById(
    id: NetworkDeviceId
  ): Promise<Result<NetworkDevice | null>>;

  /**
   * Finds a device by IP address.
   * IP addresses are unique per device.
   * Excludes soft-deleted devices (deletedAt !== null).
   * Returns null if not found (valid scenario, not an error).
   *
   * @param ipAddress - IP address
   * @returns Result<NetworkDevice | null> - Device, null, or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  findByIpAddress(
    ipAddress: IPAddress
  ): Promise<Result<NetworkDevice | null>>;

  /**
   * Finds a device by MAC address.
   * MAC addresses are unique per device.
   * Excludes soft-deleted devices (deletedAt !== null).
   * Returns null if not found (valid scenario, not an error).
   *
   * @param macAddress - MAC address
   * @returns Result<NetworkDevice | null> - Device, null, or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  findByMacAddress(
    macAddress: MACAddress
  ): Promise<Result<NetworkDevice | null>>;

  /**
   * Finds all devices with a specific status.
   * Excludes soft-deleted devices (deletedAt !== null).
   * Returns empty array if none found (valid scenario, not an error).
   *
   * @param status - Device status (ONLINE, OFFLINE, etc.)
   * @returns Result<NetworkDevice[]> - Devices with status (may be empty) or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  findByStatus(
    status: NetworkDeviceStatus
  ): Promise<Result<NetworkDevice[]>>;

  /**
   * Finds all devices (with optional pagination).
   * Excludes soft-deleted devices (deletedAt !== null).
   * Returns empty array if none found (valid scenario, not an error).
   *
   * @param limit - Maximum results
   * @param offset - Results to skip
   * @returns Result<NetworkDevice[]> - Devices (may be empty) or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  findAll(
    limit?: number,
    offset?: number
  ): Promise<Result<NetworkDevice[]>>;

  /**
   * Deletes a device by ID (permanent delete - not soft delete).
   * Use NetworkDevice.markForDeletion() for soft delete.
   * Cascade deletes polling configuration and results.
   *
   * @param id - Device ID
   * @returns Result<void> - Success or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  delete(id: NetworkDeviceId): Promise<Result<void>>;

  /**
   * Checks if a device exists with the given ID.
   * Excludes soft-deleted devices (deletedAt !== null).
   *
   * @param id - Device ID
   * @returns Result<boolean> - True if exists, false otherwise, or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  exists(id: NetworkDeviceId): Promise<Result<boolean>>;

  /**
   * Checks if an IP address is already in use.
   * Excludes soft-deleted devices (deletedAt !== null).
   * Used for uniqueness validation.
   *
   * @param ipAddress - IP address to check
   * @returns Result<boolean> - True if in use, false otherwise, or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  existsByIpAddress(ipAddress: IPAddress): Promise<Result<boolean>>;

  /**
   * Checks if a MAC address is already in use.
   * Excludes soft-deleted devices (deletedAt !== null).
   * Used for uniqueness validation.
   *
   * @param macAddress - MAC address to check
   * @returns Result<boolean> - True if in use, false otherwise, or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  existsByMacAddress(
    macAddress: MACAddress
  ): Promise<Result<boolean>>;

  /**
   * Counts total devices.
   * Excludes soft-deleted devices (deletedAt !== null).
   *
   * @returns Result<number> - Device count or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  count(): Promise<Result<number>>;

  /**
   * Counts devices by status.
   * Excludes soft-deleted devices (deletedAt !== null).
   *
   * @param status - Device status
   * @returns Result<number> - Count or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  countByStatus(status: NetworkDeviceStatus): Promise<Result<number>>;

  // ========== REQ-002: Soft Delete Operations ==========

  /**
   * Finds soft-deleted devices (deletedAt !== null).
   * Returns devices within the 7-day grace period.
   *
   * REQ-002 AC-002.6: Soft delete with 7-day grace period
   *
   * @param limit - Maximum results
   * @param offset - Results to skip
   * @returns Result<NetworkDevice[]> - Soft-deleted devices (may be empty) or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  findDeletedDevices(
    limit?: number,
    offset?: number
  ): Promise<Result<NetworkDevice[]>>;

  /**
   * Finds a device by ID, including soft-deleted devices.
   * Used for restore operations and device replacement detection.
   * Returns null if not found (valid scenario, not an error).
   *
   * REQ-002 AC-002.7: Restore deleted devices
   *
   * @param id - Device ID
   * @returns Result<NetworkDevice | null> - Device (including deleted), null, or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  findByIdIncludingDeleted(
    id: NetworkDeviceId
  ): Promise<Result<NetworkDevice | null>>;

  /**
   * Counts soft-deleted devices.
   * Includes only devices with deletedAt !== null.
   *
   * @returns Result<number> - Count of soft-deleted devices or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  countDeletedDevices(): Promise<Result<number>>;

  // ========== REQ-002: Device Replacement Detection ==========

  /**
   * Finds recently deleted device by IP address within specified days.
   * Used for device replacement workflow detection.
   * Returns null if no recently deleted device found at this IP.
   *
   * REQ-002 AC-002.9: Device replacement workflow
   *
   * @param ipAddress - IP address to search for
   * @param withinDays - Number of days to look back (typically 7)
   * @returns Result<NetworkDevice | null> - Recently deleted device, null, or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  findRecentlyDeletedByIpAddress(
    ipAddress: IPAddress,
    withinDays: number
  ): Promise<Result<NetworkDevice | null>>;

  // ========== REQ-002: Activation Status Filtering ==========

  /**
   * Finds devices by activation status (DRAFT or ACTIVE).
   * Excludes soft-deleted devices (deletedAt !== null).
   * Returns empty array if none found (valid scenario, not an error).
   *
   * REQ-002 AC-002.1: Create device in DRAFT state
   * REQ-002 AC-002.2: Activate device
   *
   * @param status - Activation status (DRAFT or ACTIVE)
   * @param limit - Maximum results
   * @param offset - Results to skip
   * @returns Result<NetworkDevice[]> - Devices with activation status (may be empty) or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  findByActivationStatus(
    status: ActivationStatus,
    limit?: number,
    offset?: number
  ): Promise<Result<NetworkDevice[]>>;

  /**
   * Counts devices by activation status.
   * Excludes soft-deleted devices (deletedAt !== null).
   *
   * @param status - Activation status (DRAFT or ACTIVE)
   * @returns Result<number> - Count or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  countByActivationStatus(
    status: ActivationStatus
  ): Promise<Result<number>>;

  // ========== REQ-002: Bulk Operations ==========

  /**
   * Saves multiple devices atomically (all or nothing).
   * Returns Result.fail() if any device violates business constraints.
   * All saves succeed or all fail (transaction semantics).
   *
   * REQ-002 AC-002.8: Bulk import via CSV
   *
   * @param devices - Array of devices to save
   * @returns Result<NetworkDevice[]> - Saved devices or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  saveMany(
    devices: NetworkDevice[]
  ): Promise<Result<NetworkDevice[]>>;

  /**
   * Deletes multiple devices atomically (all or nothing).
   * This is permanent delete - not soft delete.
   * All deletes succeed or all fail (transaction semantics).
   *
   * @param ids - Array of device IDs to delete
   * @returns Result<void> - Success or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  deleteMany(ids: NetworkDeviceId[]): Promise<Result<void>>;

  // ========== REQ-002: Advanced Filtering ==========

  /**
   * Finds devices by multiple filter criteria (combinable with AND logic).
   * All filters are optional - omitted filters are ignored.
   * Supports:
   * - status: NetworkDeviceStatus (ONLINE, OFFLINE, etc.)
   * - deviceType: NetworkDeviceType (ROUTER, SWITCH, etc.)
   * - activationStatus: ActivationStatus (DRAFT, ACTIVE)
   * - includeDeleted: boolean (default false - exclude soft-deleted)
   * - search: string (searches name, description, location)
   * - sortBy: field to sort by
   * - sortOrder: ASC or DESC
   * - limit/offset: pagination
   *
   * Returns empty array if no devices match filters (valid scenario, not an error).
   *
   * REQ-002 AC-002.3: List and filter devices
   *
   * @param filters - Filter criteria
   * @returns Result<NetworkDevice[]> - Matching devices (may be empty) or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  findByFilters(filters: {
    status?: NetworkDeviceStatus;
    deviceType?: NetworkDeviceType;
    activationStatus?: ActivationStatus;
    includeDeleted?: boolean;
    search?: string;
    sortBy?: 'createdAt' | 'name' | 'status' | 'updatedAt';
    sortOrder?: 'ASC' | 'DESC';
    limit?: number;
    offset?: number;
  }): Promise<Result<NetworkDevice[]>>;
}
