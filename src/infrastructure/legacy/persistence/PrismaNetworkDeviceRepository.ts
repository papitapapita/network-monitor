import { PrismaClient } from '../../generated/prisma/client.js';
import {
  NetworkDevice,
  NetworkDeviceId,
  IPAddress,
  MACAddress,
  NetworkDeviceStatus,
  NetworkDeviceType,
  ActivationStatus,
  Result,
  EventDispatcher
} from '../../domain/device-inventory/index.js';
import { INetworkDeviceRepository } from '../../domain/device-inventory/repository/INetworkDeviceRepository.js';
import { NetworkDeviceMapper } from '../legacy/mappers/NetworkDeviceMapper.js';
import { PollingConfigurationMapper } from '../legacy/mappers/PollingConfigurationMapper.js';

/**
 * Prisma implementation of INetworkDeviceRepository.
 *
 * Handles persistence of NetworkDevice aggregates using Prisma ORM.
 * Implements all CRUD operations with proper transaction handling and event dispatching.
 *
 * Key Features:
 * - Atomic saves with transactions (device + polling config)
 * - Event dispatching after successful commits
 * - Query optimization with includes
 * - Error handling with Result pattern
 * - Unique constraint handling (IP, MAC)
 *
 * @example
 * ```typescript
 * const repository = new PrismaNetworkDeviceRepository(prisma);
 *
 * // Create device
 * await repository.save(device);
 *
 * // Find by IP
 * const device = await repository.findByIpAddress(ipAddress);
 *
 * // List with pagination
 * const devices = await repository.findAll(20, 0);
 * ```
 */
export class PrismaNetworkDeviceRepository
  implements INetworkDeviceRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Finds a network device by its unique identifier.
   * Includes pollingConfiguration in the query.
   */
  public async findById(
    id: NetworkDeviceId
  ): Promise<Result<NetworkDevice | null>> {
    try {
      const rawDevice = await this.prisma.networkDevice.findFirst({
        where: {
          id: id.toString(),
          deletedAt: null // REQ-002: Exclude soft-deleted devices
        },
        include: {
          pollingConfiguration: true,
          deviceMonitoring: true
        }
      });

      if (!rawDevice) {
        return Result.ok<NetworkDevice | null>(null);
      }

      const domainResult = NetworkDeviceMapper.toDomain(rawDevice);
      if (domainResult.isFailure) {
        return Result.fail<NetworkDevice | null>(
          `Failed to map network device: ${domainResult.error}`
        );
      }

      return Result.ok<NetworkDevice | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<NetworkDevice | null>(
        `Database error finding network device: ${errorMessage}`
      );
    }
  }

  /**
   * Finds a network device by its IP address.
   */
  public async findByIpAddress(
    ipAddress: IPAddress
  ): Promise<Result<NetworkDevice | null>> {
    try {
      const rawDevice = await this.prisma.networkDevice.findFirst({
        where: {
          ipAddress: ipAddress.toString(),
          deletedAt: null // REQ-002: Exclude soft-deleted devices
        },
        include: {
          pollingConfiguration: true,
          deviceMonitoring: true
        }
      });

      if (!rawDevice) {
        return Result.ok<NetworkDevice | null>(null);
      }

      const domainResult = NetworkDeviceMapper.toDomain(rawDevice);
      if (domainResult.isFailure) {
        return Result.fail<NetworkDevice | null>(
          `Failed to map network device: ${domainResult.error}`
        );
      }

      return Result.ok<NetworkDevice | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<NetworkDevice | null>(
        `Database error finding network device by IP: ${errorMessage}`
      );
    }
  }

  /**
   * Finds a network device by its MAC address.
   */
  public async findByMacAddress(
    macAddress: MACAddress
  ): Promise<Result<NetworkDevice | null>> {
    try {
      const rawDevice = await this.prisma.networkDevice.findFirst({
        where: {
          macAddress: macAddress.toString(),
          deletedAt: null // REQ-002: Exclude soft-deleted devices
        },
        include: {
          pollingConfiguration: true,
          deviceMonitoring: true
        }
      });

      if (!rawDevice) {
        return Result.ok<NetworkDevice | null>(null);
      }

      const domainResult = NetworkDeviceMapper.toDomain(rawDevice);
      if (domainResult.isFailure) {
        return Result.fail<NetworkDevice | null>(
          `Failed to map network device: ${domainResult.error}`
        );
      }

      return Result.ok<NetworkDevice | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<NetworkDevice | null>(
        `Database error finding network device by MAC: ${errorMessage}`
      );
    }
  }

  /**
   * Finds all network devices with a specific status.
   * Uses deviceMonitoring.status since NetworkDevice doesn't store status directly.
   */
  public async findByStatus(
    status: NetworkDeviceStatus
  ): Promise<Result<NetworkDevice[]>> {
    try {
      const rawDevices = await this.prisma.networkDevice.findMany({
        where: {
          deletedAt: null, // REQ-002: Exclude soft-deleted devices
          deviceMonitoring: {
            status: status.toString() as any
          }
        },
        include: {
          pollingConfiguration: true,
          deviceMonitoring: true
        }
      });

      const devices: NetworkDevice[] = [];
      for (const rawDevice of rawDevices) {
        const domainResult = NetworkDeviceMapper.toDomain(rawDevice);
        if (domainResult.isFailure) {
          return Result.fail<NetworkDevice[]>(
            `Failed to map network device: ${domainResult.error}`
          );
        }
        devices.push(domainResult.value);
      }

      return Result.ok<NetworkDevice[]>(devices);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<NetworkDevice[]>(
        `Database error finding network devices by status: ${errorMessage}`
      );
    }
  }

  /**
   * Finds all network devices with optional pagination.
   */
  public async findAll(
    limit?: number,
    offset?: number
  ): Promise<Result<NetworkDevice[]>> {
    try {
      const rawDevices = await this.prisma.networkDevice.findMany({
        where: {
          deletedAt: null // REQ-002: Exclude soft-deleted devices
        },
        include: {
          pollingConfiguration: true,
          deviceMonitoring: true
        },
        take: limit,
        skip: offset,
        orderBy: {
          installDate: 'desc'
        }
      });

      const devices: NetworkDevice[] = [];
      for (const rawDevice of rawDevices) {
        const domainResult = NetworkDeviceMapper.toDomain(rawDevice);
        if (domainResult.isFailure) {
          return Result.fail<NetworkDevice[]>(
            `Failed to map network device: ${domainResult.error}`
          );
        }
        devices.push(domainResult.value);
      }

      return Result.ok<NetworkDevice[]>(devices);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<NetworkDevice[]>(
        `Database error finding all network devices: ${errorMessage}`
      );
    }
  }

  /**
   * Saves a network device (creates or updates).
   * Uses transaction to ensure atomic save of device + polling config.
   * Dispatches domain events AFTER successful commit.
   */
  public async save(
    networkDevice: NetworkDevice
  ): Promise<Result<NetworkDevice>> {
    try {
      // Convert to persistence format
      const deviceData =
        NetworkDeviceMapper.toPersistence(networkDevice);
      const pollingConfigData =
        PollingConfigurationMapper.toPersistence(
          networkDevice.pollingConfiguration
        );

      // Execute transaction
      await this.prisma.$transaction(async (tx) => {
        // Upsert network device
        await tx.networkDevice.upsert({
          where: { id: deviceData.id },
          create: deviceData,
          update: {
            name: deviceData.name,
            deviceGroup: deviceData.deviceGroup,
            deviceTypes: deviceData.deviceTypes,
            description: deviceData.description,
            connectivityType: deviceData.connectivityType,
            managementProtocol: deviceData.managementProtocol,
            managementPort: deviceData.managementPort,
            enabledRemoteAccess: deviceData.enabledRemoteAccess,
            // REQ-002: Activation workflow fields
            activationStatus: deviceData.activationStatus,
            activatedAt: deviceData.activatedAt,
            activatedBy: deviceData.activatedBy,
            // REQ-002: Soft delete fields
            deletedAt: deviceData.deletedAt,
            deletedBy: deviceData.deletedBy,
            // REQ-002: Device replacement fields
            replacedByDeviceId: deviceData.replacedByDeviceId,
            replacedAt: deviceData.replacedAt,
            // REQ-002: Optimistic locking & location
            version: deviceData.version,
            location: deviceData.location,
            // Timestamps
            updatedAt: deviceData.updatedAt
          }
        });

        // Upsert polling configuration
        await tx.pollingConfiguration.upsert({
          where: { id: pollingConfigData.id },
          create: pollingConfigData,
          update: {
            intervalSeconds: pollingConfigData.intervalSeconds,
            enabled: pollingConfigData.enabled,
            pingCount: pollingConfigData.pingCount,
            maxRetryAttempts: pollingConfigData.maxRetryAttempts,
            retryDelayMs: pollingConfigData.retryDelayMs,
            lastScheduledAt: pollingConfigData.lastScheduledAt,
            nextScheduledAt: pollingConfigData.nextScheduledAt
          }
        });
      });

      // Dispatch domain events AFTER successful commit
      EventDispatcher.dispatchEventsForAggregate(networkDevice.id);

      return Result.ok<NetworkDevice>(networkDevice);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Handle Prisma unique constraint violations
      if (errorMessage.includes('P2002')) {
        if (errorMessage.includes('ipAddress')) {
          return Result.fail<NetworkDevice>(
            'A device with this IP address already exists'
          );
        }
        if (errorMessage.includes('macAddress')) {
          return Result.fail<NetworkDevice>(
            'A device with this MAC address already exists'
          );
        }
        return Result.fail<NetworkDevice>(
          'A device with these unique values already exists'
        );
      }

      return Result.fail<NetworkDevice>(
        `Database error saving network device: ${errorMessage}`
      );
    }
  }

  /**
   * Deletes a network device.
   * CASCADE delete handles PollingConfiguration and PollingResult removal.
   */
  public async delete(id: NetworkDeviceId): Promise<Result<void>> {
    try {
      await this.prisma.networkDevice.delete({
        where: { id: id.toString() }
      });

      return Result.ok<void>();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Handle record not found
      if (errorMessage.includes('P2025')) {
        return Result.fail<void>('Network device not found');
      }

      return Result.fail<void>(
        `Database error deleting network device: ${errorMessage}`
      );
    }
  }

  /**
   * Checks if a network device exists with the given ID.
   */
  public async exists(id: NetworkDeviceId): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.networkDevice.count({
        where: {
          id: id.toString(),
          deletedAt: null // REQ-002: Exclude soft-deleted devices
        }
      });

      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking device existence: ${errorMessage}`
      );
    }
  }

  /**
   * Checks if a network device exists with the given IP address.
   */
  public async existsByIpAddress(
    ipAddress: IPAddress
  ): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.networkDevice.count({
        where: {
          ipAddress: ipAddress.toString(),
          deletedAt: null // REQ-002: Exclude soft-deleted devices
        }
      });

      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking IP existence: ${errorMessage}`
      );
    }
  }

  /**
   * Checks if a network device exists with the given MAC address.
   */
  public async existsByMacAddress(
    macAddress: MACAddress
  ): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.networkDevice.count({
        where: {
          macAddress: macAddress.toString(),
          deletedAt: null // REQ-002: Exclude soft-deleted devices
        }
      });

      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking MAC existence: ${errorMessage}`
      );
    }
  }

  /**
   * Counts total number of network devices.
   */
  public async count(): Promise<Result<number>> {
    try {
      const count = await this.prisma.networkDevice.count({
        where: {
          deletedAt: null // REQ-002: Exclude soft-deleted devices
        }
      });
      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting devices: ${errorMessage}`
      );
    }
  }

  /**
   * Counts network devices by status.
   */
  public async countByStatus(
    status: NetworkDeviceStatus
  ): Promise<Result<number>> {
    try {
      const count = await this.prisma.networkDevice.count({
        where: {
          deletedAt: null, // REQ-002: Exclude soft-deleted devices
          deviceMonitoring: {
            status: status.toString() as any
          }
        }
      });

      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting devices by status: ${errorMessage}`
      );
    }
  }

  // ===================================
  // REQ-002: NEW METHODS
  // ===================================

  /**
   * REQ-002: Finds all soft-deleted network devices.
   * Used for displaying devices in 7-day grace period.
   *
   * @param limit - Optional limit for pagination
   * @param offset - Optional offset for pagination
   * @returns Result containing array of soft-deleted devices
   */
  public async findDeletedDevices(
    limit?: number,
    offset?: number
  ): Promise<Result<NetworkDevice[]>> {
    try {
      const rawDevices = await this.prisma.networkDevice.findMany({
        where: {
          deletedAt: { not: null } // Only soft-deleted devices
        },
        include: {
          pollingConfiguration: true,
          deviceMonitoring: true
        },
        take: limit,
        skip: offset,
        orderBy: {
          deletedAt: 'desc' // Most recently deleted first
        }
      });

      const devices: NetworkDevice[] = [];
      for (const rawDevice of rawDevices) {
        const domainResult = NetworkDeviceMapper.toDomain(rawDevice);
        if (domainResult.isFailure) {
          return Result.fail<NetworkDevice[]>(
            `Failed to map network device: ${domainResult.error}`
          );
        }
        devices.push(domainResult.value);
      }

      return Result.ok<NetworkDevice[]>(devices);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<NetworkDevice[]>(
        `Database error finding deleted devices: ${errorMessage}`
      );
    }
  }

  /**
   * REQ-002: Finds a network device by ID including soft-deleted devices.
   * Used for restore operations and administrative views.
   *
   * @param id - NetworkDeviceId to search for
   * @returns Result containing device or null
   */
  public async findByIdIncludingDeleted(
    id: NetworkDeviceId
  ): Promise<Result<NetworkDevice | null>> {
    try {
      const rawDevice = await this.prisma.networkDevice.findUnique({
        where: { id: id.toString() },
        include: {
          pollingConfiguration: true,
          deviceMonitoring: true
        }
      });

      if (!rawDevice) {
        return Result.ok<NetworkDevice | null>(null);
      }

      const domainResult = NetworkDeviceMapper.toDomain(rawDevice);
      if (domainResult.isFailure) {
        return Result.fail<NetworkDevice | null>(
          `Failed to map network device: ${domainResult.error}`
        );
      }

      return Result.ok<NetworkDevice | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<NetworkDevice | null>(
        `Database error finding device including deleted: ${errorMessage}`
      );
    }
  }

  /**
   * REQ-002: Counts total number of soft-deleted devices.
   * Used for dashboard metrics and cleanup monitoring.
   *
   * @returns Result containing count of deleted devices
   */
  public async countDeletedDevices(): Promise<Result<number>> {
    try {
      const count = await this.prisma.networkDevice.count({
        where: {
          deletedAt: { not: null }
        }
      });

      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting deleted devices: ${errorMessage}`
      );
    }
  }

  /**
   * REQ-002: Finds recently deleted devices by IP address within a time window.
   * Used for device replacement detection workflow.
   *
   * @param ipAddress - IP address to search for
   * @param withinDays - Number of days to look back (default: 7)
   * @returns Result containing array of matching devices
   */
  public async findRecentlyDeletedByIpAddress(
    ipAddress: IPAddress,
    withinDays: number = 7
  ): Promise<Result<NetworkDevice[]>> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - withinDays);

      const rawDevices = await this.prisma.networkDevice.findMany({
        where: {
          ipAddress: ipAddress.toString(),
          deletedAt: {
            not: null,
            gte: cutoffDate // Deleted within the time window
          }
        },
        include: {
          pollingConfiguration: true,
          deviceMonitoring: true
        },
        orderBy: {
          deletedAt: 'desc'
        }
      });

      const devices: NetworkDevice[] = [];
      for (const rawDevice of rawDevices) {
        const domainResult = NetworkDeviceMapper.toDomain(rawDevice);
        if (domainResult.isFailure) {
          return Result.fail<NetworkDevice[]>(
            `Failed to map network device: ${domainResult.error}`
          );
        }
        devices.push(domainResult.value);
      }

      return Result.ok<NetworkDevice[]>(devices);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<NetworkDevice[]>(
        `Database error finding recently deleted devices by IP: ${errorMessage}`
      );
    }
  }

  /**
   * REQ-002: Finds devices by activation status.
   * Used for filtering DRAFT vs ACTIVE devices.
   *
   * @param status - ActivationStatus to filter by
   * @param limit - Optional limit for pagination
   * @param offset - Optional offset for pagination
   * @returns Result containing array of devices
   */
  public async findByActivationStatus(
    status: ActivationStatus,
    limit?: number,
    offset?: number
  ): Promise<Result<NetworkDevice[]>> {
    try {
      const rawDevices = await this.prisma.networkDevice.findMany({
        where: {
          deletedAt: null, // Exclude soft-deleted
          activationStatus: status.toString() as any
        },
        include: {
          pollingConfiguration: true,
          deviceMonitoring: true
        },
        take: limit,
        skip: offset,
        orderBy: {
          createdAt: 'desc'
        }
      });

      const devices: NetworkDevice[] = [];
      for (const rawDevice of rawDevices) {
        const domainResult = NetworkDeviceMapper.toDomain(rawDevice);
        if (domainResult.isFailure) {
          return Result.fail<NetworkDevice[]>(
            `Failed to map network device: ${domainResult.error}`
          );
        }
        devices.push(domainResult.value);
      }

      return Result.ok<NetworkDevice[]>(devices);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<NetworkDevice[]>(
        `Database error finding devices by activation status: ${errorMessage}`
      );
    }
  }

  /**
   * REQ-002: Counts devices by activation status.
   * Used for dashboard metrics showing DRAFT vs ACTIVE counts.
   *
   * @param status - ActivationStatus to count
   * @returns Result containing count
   */
  public async countByActivationStatus(
    status: ActivationStatus
  ): Promise<Result<number>> {
    try {
      const count = await this.prisma.networkDevice.count({
        where: {
          deletedAt: null, // Exclude soft-deleted
          activationStatus: status.toString() as any
        }
      });

      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting devices by activation status: ${errorMessage}`
      );
    }
  }

  /**
   * REQ-002: Saves multiple network devices in a transaction.
   * Used for bulk device creation/updates during CSV import.
   *
   * @param devices - Array of NetworkDevice aggregates to save
   * @returns Result containing array of saved devices
   */
  public async saveMany(
    devices: NetworkDevice[]
  ): Promise<Result<NetworkDevice[]>> {
    try {
      // Convert all devices to persistence format
      const deviceDataArray = devices.map((device) =>
        NetworkDeviceMapper.toPersistence(device)
      );
      const pollingConfigDataArray = devices.map((device) =>
        PollingConfigurationMapper.toPersistence(
          device.pollingConfiguration
        )
      );

      // Execute transaction
      await this.prisma.$transaction(async (tx) => {
        // Upsert all devices
        for (const deviceData of deviceDataArray) {
          await tx.networkDevice.upsert({
            where: { id: deviceData.id },
            create: deviceData,
            update: {
              name: deviceData.name,
              deviceGroup: deviceData.deviceGroup,
              deviceTypes: deviceData.deviceTypes,
              description: deviceData.description,
              connectivityType: deviceData.connectivityType,
              managementProtocol: deviceData.managementProtocol,
              managementPort: deviceData.managementPort,
              enabledRemoteAccess: deviceData.enabledRemoteAccess,
              activationStatus: deviceData.activationStatus,
              activatedAt: deviceData.activatedAt,
              activatedBy: deviceData.activatedBy,
              deletedAt: deviceData.deletedAt,
              deletedBy: deviceData.deletedBy,
              replacedByDeviceId: deviceData.replacedByDeviceId,
              replacedAt: deviceData.replacedAt,
              version: deviceData.version,
              location: deviceData.location,
              updatedAt: deviceData.updatedAt
            }
          });
        }

        // Upsert all polling configurations
        for (const pollingConfigData of pollingConfigDataArray) {
          await tx.pollingConfiguration.upsert({
            where: { id: pollingConfigData.id },
            create: pollingConfigData,
            update: {
              intervalSeconds: pollingConfigData.intervalSeconds,
              enabled: pollingConfigData.enabled,
              pingCount: pollingConfigData.pingCount,
              maxRetryAttempts: pollingConfigData.maxRetryAttempts,
              retryDelayMs: pollingConfigData.retryDelayMs,
              lastScheduledAt: pollingConfigData.lastScheduledAt,
              nextScheduledAt: pollingConfigData.nextScheduledAt
            }
          });
        }
      });

      // Dispatch domain events for all devices AFTER successful commit
      for (const device of devices) {
        EventDispatcher.dispatchEventsForAggregate(device.id);
      }

      return Result.ok<NetworkDevice[]>(devices);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Handle Prisma unique constraint violations
      if (errorMessage.includes('P2002')) {
        return Result.fail<NetworkDevice[]>(
          'One or more devices have duplicate unique values (IP or MAC address)'
        );
      }

      return Result.fail<NetworkDevice[]>(
        `Database error saving multiple devices: ${errorMessage}`
      );
    }
  }

  /**
   * REQ-002: Deletes multiple network devices in a transaction.
   * Used for bulk operations and cleanup.
   *
   * @param ids - Array of NetworkDeviceIds to delete
   * @returns Result<void>
   */
  public async deleteMany(
    ids: NetworkDeviceId[]
  ): Promise<Result<void>> {
    try {
      const idStrings = ids.map((id) => id.toString());

      await this.prisma.$transaction(async (tx) => {
        await tx.networkDevice.deleteMany({
          where: {
            id: {
              in: idStrings
            }
          }
        });
      });

      return Result.ok<void>();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return Result.fail<void>(
        `Database error deleting multiple devices: ${errorMessage}`
      );
    }
  }

  /**
   * REQ-002: Advanced filtering with multiple criteria.
   * Used for complex search operations in the UI.
   *
   * @param filters - Object containing optional filter criteria
   * @returns Result containing array of matching devices
   */
  public async findByFilters(filters: {
    deviceType?: NetworkDeviceType;
    activationStatus?: ActivationStatus;
    status?: NetworkDeviceStatus;
    ipAddress?: IPAddress;
    macAddress?: MACAddress;
    includeDeleted?: boolean;
    location?: string;
    limit?: number;
    offset?: number;
  }): Promise<Result<NetworkDevice[]>> {
    try {
      // Build dynamic WHERE clause
      const where: any = {};

      // Soft delete filter
      if (!filters.includeDeleted) {
        where.deletedAt = null;
      }

      // Device type filter
      if (filters.deviceType) {
        where.deviceGroup = NetworkDeviceMapper[
          'mapDeviceTypeToPrisma'
        ](filters.deviceType);
      }

      // Activation status filter
      if (filters.activationStatus) {
        where.activationStatus = filters.activationStatus.toString();
      }

      // Device status filter
      if (filters.status) {
        where.deviceMonitoring = {
          status: filters.status.toString()
        };
      }

      // IP address filter
      if (filters.ipAddress) {
        where.ipAddress = filters.ipAddress.toString();
      }

      // MAC address filter
      if (filters.macAddress) {
        where.macAddress = filters.macAddress.toString();
      }

      // Location filter (partial match)
      if (filters.location) {
        where.location = {
          contains: filters.location,
          mode: 'insensitive'
        };
      }

      const rawDevices = await this.prisma.networkDevice.findMany({
        where,
        include: {
          pollingConfiguration: true,
          deviceMonitoring: true
        },
        take: filters.limit,
        skip: filters.offset,
        orderBy: {
          createdAt: 'desc'
        }
      });

      const devices: NetworkDevice[] = [];
      for (const rawDevice of rawDevices) {
        const domainResult = NetworkDeviceMapper.toDomain(rawDevice);
        if (domainResult.isFailure) {
          return Result.fail<NetworkDevice[]>(
            `Failed to map network device: ${domainResult.error}`
          );
        }
        devices.push(domainResult.value);
      }

      return Result.ok<NetworkDevice[]>(devices);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<NetworkDevice[]>(
        `Database error finding devices by filters: ${errorMessage}`
      );
    }
  }
}
