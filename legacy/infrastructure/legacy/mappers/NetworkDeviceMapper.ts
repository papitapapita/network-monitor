import {
  Result,
  NetworkDevice,
  NetworkDeviceId,
  IPAddress,
  MACAddress,
  NetworkDeviceType,
  NetworkDeviceStatus,
  ConnectivityType,
  ManagementProtocol,
  ActivationStatus
} from '../../../domain/device-inventory';
import { PollingConfigurationMapper } from './PollingConfigurationMapper';

/**
 * Mapper for converting NetworkDevice aggregate to/from Prisma model.
 *
 * Handles bidirectional conversion between:
 * - Domain aggregate (NetworkDevice)
 * - Persistence model (Prisma NetworkDevice)
 *
 * Critical mappings:
 * - deviceGroup (Prisma) → deviceType (Domain)
 * - Nested PollingConfiguration entity
 * - Value object conversions (IPAddress, MACAddress)
 * - Enum conversions (DeviceType, NetworkDeviceStatus, ConnectivityType, ManagementProtocol)
 */
export class NetworkDeviceMapper {
  /**
   * Converts a Prisma NetworkDevice model to domain aggregate.
   *
   * @param raw - Raw Prisma model data (must include pollingConfiguration)
   * @returns Result containing NetworkDevice aggregate or error message
   */
  public static toDomain(raw: any): Result<NetworkDevice> {
    // Validate pollingConfiguration is included
    if (!raw.pollingConfiguration) {
      return Result.fail<NetworkDevice>(
        'NetworkDevice must include pollingConfiguration'
      );
    }

    // Convert ID
    const networkDeviceId = NetworkDeviceId.create(raw.id);
    if (networkDeviceId.isFailure) {
      return Result.fail<NetworkDevice>(networkDeviceId.error!);
    }

    // Convert value objects
    const ipAddress = IPAddress.reconstitute(raw.ipAddress);

    const macAddress = MACAddress.reconstitute(raw.macAddress);

    // Convert PollingConfiguration
    const pollingConfig = PollingConfigurationMapper.toDomain(
      raw.pollingConfiguration
    );
    if (pollingConfig.isFailure) {
      return Result.fail<NetworkDevice>(pollingConfig.error!);
    }

    // Map Prisma DeviceType (deviceGroup) to domain NetworkDeviceType
    const deviceType = this.mapDeviceTypeFromPrisma(raw.deviceGroup);

    // Map Prisma NetworkDeviceStatus to domain NetworkDeviceStatus
    const status = this.mapStatusFromPrisma(
      raw.deviceMonitoring?.status
    );

    // Map Prisma ConnectivityType to domain ConnectivityType
    const connectivityType = this.mapConnectivityTypeFromPrisma(
      raw.connectivityType
    );

    // Map Prisma ManagementProtocol to domain ManagementProtocol
    const managementProtocol = this.mapManagementProtocolFromPrisma(
      raw.managementProtocol
    );

    // Map Prisma ActivationStatus to domain ActivationStatus
    const activationStatus = this.mapActivationStatusFromPrisma(
      raw.activationStatus
    );

    // Map replacedByDeviceId if present
    const replacedByDeviceId = raw.replacedByDeviceId
      ? NetworkDeviceId.create(raw.replacedByDeviceId).value
      : null;

    // Create domain entity
    return NetworkDevice.create(
      {
        name: raw.name,
        deviceType,
        status,
        description: raw.description || null,
        installDate: raw.installDate,
        ipAddress: ipAddress,
        macAddress: macAddress,
        connectivityType,
        managementProtocol,
        managementPort: raw.managementPort,
        enabledRemoteAccess: raw.enabledRemoteAccess,
        deviceId: raw.deviceId,
        pollingConfiguration: pollingConfig.value,

        // REQ-002: Activation workflow fields
        activationStatus,
        activatedAt: raw.activatedAt || null,
        activatedBy: raw.activatedBy || null,

        // REQ-002: Soft delete fields
        deletedAt: raw.deletedAt || null,
        deletedBy: raw.deletedBy || null,

        // REQ-002: Device replacement fields
        replacedByDeviceId,
        replacedAt: raw.replacedAt || null,

        // REQ-002: Optimistic locking & location
        version: raw.version || 1,
        location: raw.location || null,

        // Timestamps
        createdAt: raw.createdAt || raw.installDate,
        updatedAt: raw.updatedAt || new Date()
      },
      networkDeviceId.value
    );
  }

  /**
   * Converts a NetworkDevice domain aggregate to Prisma model format.
   *
   * @param device - Domain aggregate
   * @returns Object ready for Prisma create/update operations
   */
  public static toPersistence(device: NetworkDevice): any {
    return {
      id: device.id.toString(),
      name: device.name,
      deviceGroup: this.mapDeviceTypeToPrisma(device.deviceType),
      deviceTypes: this.mapDeviceTypesToRoles(device.deviceType),
      description: device.description,
      installDate: device.installDate,
      ipAddress: device.ipAddress.toString(),
      macAddress: device.macAddress.toString(),
      connectivityType: this.mapConnectivityTypeToPrisma(
        device.connectivityType
      ),
      managementProtocol: this.mapManagementProtocolToPrisma(
        device.managementProtocol
      ),
      managementPort: device.managementPort,
      enabledRemoteAccess: device.enabledRemoteAccess,
      deviceId: device.deviceId,

      // REQ-002: Activation workflow fields
      activationStatus: this.mapActivationStatusToPrisma(
        device.activationStatus
      ),
      activatedAt: device.activatedAt,
      activatedBy: device.activatedBy,

      // REQ-002: Soft delete fields
      deletedAt: device.deletedAt,
      deletedBy: device.deletedBy,

      // REQ-002: Device replacement fields
      replacedByDeviceId: device.replacedByDeviceId
        ? device.replacedByDeviceId.toString()
        : null,
      replacedAt: device.replacedAt,

      // REQ-002: Optimistic locking & location
      version: device.version,
      location: device.location,

      // Timestamps
      createdAt: device.createdAt,
      updatedAt: device.updatedAt
    };
  }

  /**
   * Maps Prisma DeviceType to domain NetworkDeviceType.
   */
  private static mapDeviceTypeFromPrisma(
    prismaType: string
  ): NetworkDeviceType {
    switch (prismaType) {
      case 'ROUTER':
        return NetworkDeviceType.ROUTER;
      case 'SWITCH':
        return NetworkDeviceType.SWITCH;
      case 'RADIO':
      case 'WIRELESS':
        return NetworkDeviceType.ACCESS_POINT; // Default wireless to AP
      case 'FIREWALL':
      case 'SECURITY':
        return NetworkDeviceType.FIREWALL;
      case 'SERVER':
        return NetworkDeviceType.SERVER;
      default:
        return NetworkDeviceType.UNKNOWN;
    }
  }

  /**
   * Maps domain NetworkDeviceType to Prisma DeviceType.
   */
  private static mapDeviceTypeToPrisma(
    deviceType: NetworkDeviceType
  ): string {
    switch (deviceType) {
      case NetworkDeviceType.ROUTER:
        return 'ROUTER';
      case NetworkDeviceType.SWITCH:
        return 'SWITCH';
      case NetworkDeviceType.ACCESS_POINT:
      case NetworkDeviceType.STATION:
      case NetworkDeviceType.PTP_RADIO:
      case NetworkDeviceType.PTMP_RADIO:
        return 'RADIO';
      case NetworkDeviceType.FIREWALL:
        return 'FIREWALL';
      case NetworkDeviceType.SERVER:
        return 'SERVER';
      case NetworkDeviceType.UNKNOWN:
      default:
        return 'EDGE'; // Default to EDGE for unknown types
    }
  }

  /**
   * Maps domain NetworkDeviceType to Prisma NetworkDeviceRole array.
   * This populates the deviceTypes array in the database.
   */
  private static mapDeviceTypesToRoles(
    deviceType: NetworkDeviceType
  ): string[] {
    switch (deviceType) {
      case NetworkDeviceType.ROUTER:
        return ['ROUTING'];
      case NetworkDeviceType.SWITCH:
        return ['SWITCHING'];
      case NetworkDeviceType.ACCESS_POINT:
        return ['WIRELESS_ACCESS'];
      case NetworkDeviceType.STATION:
        return ['WIRELESS_ACCESS'];
      case NetworkDeviceType.PTP_RADIO:
        return ['WIRELESS_BRIDGE', 'RADIO_LINK'];
      case NetworkDeviceType.PTMP_RADIO:
        return ['WIRELESS_CONTROLLER', 'BACKHAUL'];
      case NetworkDeviceType.FIREWALL:
        return ['FIREWALL'];
      case NetworkDeviceType.SERVER:
        return ['APPLICATION_HOSTING'];
      case NetworkDeviceType.UNKNOWN:
      default:
        return ['MONITORING'];
    }
  }

  /**
   * Maps Prisma NetworkDeviceStatus to domain NetworkDeviceStatus.
   * If status is null/undefined, defaults to OFFLINE.
   */
  private static mapStatusFromPrisma(
    prismaStatus?: string
  ): NetworkDeviceStatus {
    if (!prismaStatus) {
      return NetworkDeviceStatus.OFFLINE;
    }

    switch (prismaStatus) {
      case 'ONLINE':
        return NetworkDeviceStatus.ONLINE;
      case 'OFFLINE':
        return NetworkDeviceStatus.OFFLINE;
      case 'MAINTENANCE':
        return NetworkDeviceStatus.MAINTENANCE;
      default:
        return NetworkDeviceStatus.OFFLINE;
    }
  }

  /**
   * Maps Prisma ConnectivityType to domain ConnectivityType.
   */
  private static mapConnectivityTypeFromPrisma(
    prismaType: string
  ): ConnectivityType {
    switch (prismaType) {
      case 'ETHERNET':
        return ConnectivityType.ETHERNET;
      case 'FIBER_OPTIC':
        return ConnectivityType.FIBER_OPTIC;
      case 'WIRELESS':
        return ConnectivityType.WIRELESS;
      case 'DSL':
        return ConnectivityType.DSL;
      case 'SATELLITE':
        return ConnectivityType.SATELLITE;
      case 'OTHER':
      default:
        return ConnectivityType.OTHER;
    }
  }

  /**
   * Maps domain ConnectivityType to Prisma ConnectivityType.
   */
  private static mapConnectivityTypeToPrisma(
    connectivityType: ConnectivityType
  ): string {
    switch (connectivityType) {
      case ConnectivityType.ETHERNET:
        return 'ETHERNET';
      case ConnectivityType.FIBER_OPTIC:
        return 'FIBER_OPTIC';
      case ConnectivityType.WIRELESS:
        return 'WIRELESS';
      case ConnectivityType.DSL:
        return 'DSL';
      case ConnectivityType.SATELLITE:
        return 'SATELLITE';
      case ConnectivityType.OTHER:
      default:
        return 'OTHER';
    }
  }

  /**
   * Maps Prisma ManagementProtocol to domain ManagementProtocol.
   */
  private static mapManagementProtocolFromPrisma(
    prismaProtocol: string
  ): ManagementProtocol {
    switch (prismaProtocol) {
      case 'SNMP':
        return ManagementProtocol.SNMP;
      case 'SSH':
        return ManagementProtocol.SSH;
      case 'TELNET':
        return ManagementProtocol.TELNET;
      case 'HTTP':
        return ManagementProtocol.HTTP;
      case 'HTTPS':
        return ManagementProtocol.HTTPS;
      case 'OTHER':
      default:
        return ManagementProtocol.OTHER;
    }
  }

  /**
   * Maps domain ManagementProtocol to Prisma ManagementProtocol.
   */
  private static mapManagementProtocolToPrisma(
    managementProtocol: ManagementProtocol
  ): string {
    switch (managementProtocol) {
      case ManagementProtocol.SNMP:
        return 'SNMP';
      case ManagementProtocol.SSH:
        return 'SSH';
      case ManagementProtocol.TELNET:
        return 'TELNET';
      case ManagementProtocol.HTTP:
        return 'HTTP';
      case ManagementProtocol.HTTPS:
        return 'HTTPS';
      case ManagementProtocol.OTHER:
      default:
        return 'OTHER';
    }
  }

  /**
   * Maps Prisma ActivationStatus to domain ActivationStatus.
   * REQ-002: Device lifecycle activation status mapping.
   */
  private static mapActivationStatusFromPrisma(
    prismaStatus: string
  ): ActivationStatus {
    switch (prismaStatus) {
      case 'DRAFT':
        return ActivationStatus.DRAFT;
      case 'ACTIVE':
        return ActivationStatus.ACTIVE;
      default:
        return ActivationStatus.DRAFT; // Default to DRAFT for safety
    }
  }

  /**
   * Maps domain ActivationStatus to Prisma ActivationStatus.
   * REQ-002: Device lifecycle activation status mapping.
   */
  private static mapActivationStatusToPrisma(
    activationStatus: ActivationStatus
  ): string {
    switch (activationStatus) {
      case ActivationStatus.DRAFT:
        return 'DRAFT';
      case ActivationStatus.ACTIVE:
        return 'ACTIVE';
      default:
        return 'DRAFT';
    }
  }
}
