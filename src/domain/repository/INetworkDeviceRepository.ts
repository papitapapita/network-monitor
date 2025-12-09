import {
  NetworkDevice,
  NetworkDeviceId,
  IPAddress,
  Result,
  MACAddress,
  NetworkDeviceStatus
} from '../';

/**
 * INetworkDeviceRepository
 *
 * Repository interface for NetworkDevice aggregate.
 * Defines the contract for persistence operations on network devices.
 *
 * This interface follows the Repository pattern from Domain-Driven Design,
 * providing an abstraction over data access that allows the domain layer
 * to remain independent of infrastructure concerns.
 */
export interface INetworkDeviceRepository {
  /**
   * Finds a network device by its unique identifier.
   *
   * @param id - The network device ID
   * @returns Result containing the NetworkDevice or null if not found
   */
  findById(
    id: NetworkDeviceId
  ): Promise<Result<NetworkDevice | null>>;

  /**
   * Finds a network device by its IP address.
   *
   * @param ipAddress - The IP address to search for
   * @returns Result containing the NetworkDevice or null if not found
   */
  findByIpAddress(
    ipAddress: IPAddress
  ): Promise<Result<NetworkDevice | null>>;

  /**
   * Finds a network device by its MAC address.
   *
   * @param macAddress - The MAC address to search for
   * @returns Result containing the NetworkDevice or null if not found
   */
  findByMacAddress(
    macAddress: MACAddress
  ): Promise<Result<NetworkDevice | null>>;

  /**
   * Finds all network devices with a specific status.
   *
   * @param status - The device status to filter by
   * @returns Result containing array of NetworkDevices
   */
  findByStatus(
    status: NetworkDeviceStatus
  ): Promise<Result<NetworkDevice[]>>;

  /**
   * Finds all network devices.
   *
   * @param limit - Optional limit on number of results
   * @param offset - Optional offset for pagination
   * @returns Result containing array of NetworkDevices
   */
  findAll(
    limit?: number,
    offset?: number
  ): Promise<Result<NetworkDevice[]>>;

  /**
   * Saves a network device (creates or updates).
   *
   * @param networkDevice - The network device to save
   * @returns Result containing the saved NetworkDevice
   */
  save(networkDevice: NetworkDevice): Promise<Result<NetworkDevice>>;

  /**
   * Deletes a network device.
   *
   * @param id - The network device ID to delete
   * @returns Result indicating success or failure
   */
  delete(id: NetworkDeviceId): Promise<Result<void>>;

  /**
   * Checks if a network device exists with the given ID.
   *
   * @param id - The network device ID
   * @returns Result containing boolean indicating existence
   */
  exists(id: NetworkDeviceId): Promise<Result<boolean>>;

  /**
   * Checks if a network device exists with the given IP address.
   *
   * @param ipAddress - The IP address
   * @returns Result containing boolean indicating existence
   */
  existsByIpAddress(ipAddress: IPAddress): Promise<Result<boolean>>;

  /**
   * Checks if a network device exists with the given MAC address.
   *
   * @param macAddress - The MAC address
   * @returns Result containing boolean indicating existence
   */
  existsByMacAddress(
    macAddress: MACAddress
  ): Promise<Result<boolean>>;

  /**
   * Counts total number of network devices.
   *
   * @returns Result containing the count
   */
  count(): Promise<Result<number>>;

  /**
   * Counts network devices by status.
   *
   * @param status - The device status
   * @returns Result containing the count
   */
  countByStatus(status: NetworkDeviceStatus): Promise<Result<number>>;
}
