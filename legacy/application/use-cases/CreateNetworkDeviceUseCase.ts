import {
  Result,
  NetworkDevice,
  IPAddress,
  MACAddress,
  NetworkDeviceType,
  NetworkDeviceStatus,
  ConnectivityType,
  ManagementProtocol,
  PollingConfiguration,
  PollingInterval,
  INetworkDeviceRepository,
  PollingConfigurationId,
  NetworkDeviceId,
  ActivationStatus
} from '../../../domain/device-inventory';
import { UseCase } from '../../shared/core/UseCase';
import { ILogger } from '../../shared/interfaces/ILogger';
import { CreateNetworkDeviceDTO } from '../dtos/CreateNetworkDeviceDTO';
import { NetworkDeviceResponseDTO } from '../dtos/NetworkDeviceResponseDTO';
import { NetworkDeviceMapper } from '../mappers/NetworkDeviceMapper';
import { ExtractedCreateData } from '../interfaces/ExtractedCreateData';

/**
 * CreateNetworkDeviceUseCase
 *
 * Business Intent: Create a new network device in either DRAFT or ACTIVE status
 *
 * Flow:
 * 1. beforeExecute: Validate IP/MAC format and check uniqueness
 * 2. executeImpl: Orchestrate device creation
 * 3. afterExecute: Events auto-dispatched by repository (via base class)
 *
 * Creation Modes:
 * - DRAFT Mode (activateImmediately = false, default):
 *   * Minimal validation (IP, MAC, deviceId only)
 *   * Device created in DRAFT status
 *   * Name and deviceType optional
 *   * Use ActivateNetworkDeviceUseCase later to activate
 *   * Ideal for network discovery workflows
 *
 * - ACTIVE Mode (activateImmediately = true):
 *   * Full validation (name, deviceType required)
 *   * Device created in ACTIVE status immediately
 *   * Sets activatedAt timestamp and activatedBy from context
 *   * Ideal for manual device registration
 *
 * Business Rules:
 * - IP and MAC addresses must be unique (excluding soft-deleted devices)
 * - deviceId is required (references Device entity)
 * - DRAFT mode: Only IP, MAC, deviceId required
 * - ACTIVE mode: Also requires name and deviceType
 * - All devices start with status = OFFLINE (operational status)
 * - Polling configuration created but disabled by default
 * - Default polling intervals based on device type:
 *   * ACCESS_POINT: 30 seconds
 *   * STATION: 300 seconds (5 minutes)
 *   * ROUTER/SWITCH: 60 seconds
 *   * Others: 60 seconds
 *
 * Requirements:
 * - REQ-002: CRUD Operations with Draft/Active States (AC-002.1)
 * - REQ-002: Activation Workflow
 * - REQ-002: Device must start with polling disabled
 * - REQ-002: Location tracking field support
 *
 * Dependencies:
 * - INetworkDeviceRepository: Persist device aggregate
 * - ILogger: Log operations
 *
 * @example DRAFT mode (network discovery)
 * ```typescript
 * const useCase = new CreateNetworkDeviceUseCase(repository, logger);
 * const result = await useCase.execute({
 *   ipAddress: '192.168.1.100',
 *   macAddress: '00:11:22:33:44:55',
 *   deviceId: 'device-123',
 *   activateImmediately: false  // Creates in DRAFT status
 * });
 * ```
 *
 * @example ACTIVE mode (manual registration)
 * ```typescript
 * const result = await useCase.execute({
 *   ipAddress: '192.168.1.1',
 *   macAddress: 'AA:BB:CC:DD:EE:FF',
 *   deviceId: 'device-uuid-here',
 *   name: 'Router-Core-01',
 *   deviceType: 'ROUTER',
 *   description: 'Main core router',
 *   location: 'Building A, Floor 2',
 *   activateImmediately: true  // Creates in ACTIVE status
 * });
 * ```
 */
export class CreateNetworkDeviceUseCase extends UseCase<
  CreateNetworkDeviceDTO,
  NetworkDeviceResponseDTO
> {
  constructor(
    private readonly deviceRepository: INetworkDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'CreateNetworkDeviceUseCase');
  }

  /**
   * Pre-execution validation.
   * Validates IP/MAC format and checks uniqueness constraints.
   */
  protected async beforeExecute(
    request: CreateNetworkDeviceDTO
  ): Promise<Result<void> | null> {
    if (!request.ipAddress) {
      return Result.fail('IP address is required');
    }

    if (!request.macAddress) {
      return Result.fail('MAC address is required');
    }

    const ipResult = IPAddress.create(request.ipAddress);
    if (ipResult.isFailure) {
      return Result.fail(`Invalid IP address: ${ipResult.error}`);
    }

    const macResult = MACAddress.create(request.macAddress);
    if (macResult.isFailure) {
      return Result.fail(`Invalid MAC address: ${macResult.error}`);
    }

    const ipExistsResult =
      await this.deviceRepository.existsByIpAddress(ipResult.value);
    if (ipExistsResult.isFailure) {
      return Result.fail(
        `Error checking IP uniqueness: ${ipExistsResult.error}`
      );
    }
    if (ipExistsResult.value) {
      return Result.fail(
        `A device with IP address ${request.ipAddress} already exists`
      );
    }

    const macExistsResult =
      await this.deviceRepository.existsByMacAddress(macResult.value);
    if (macExistsResult.isFailure) {
      return Result.fail(
        `Error checking MAC uniqueness: ${macExistsResult.error}`
      );
    }
    if (macExistsResult.value) {
      return Result.fail(
        `A device with MAC address ${request.macAddress} already exists`
      );
    }

    return null; // Validation passed
  }

  /**
   * Main execution: Orchestrate network device creation.
   *
   * Steps:
   * 1. Extract raw data from DTO (Mapper)
   * 2. Validate business rules for creation mode
   * 3. Create value objects
   * 4. Map string enums to domain enums (Business logic)
   * 5. Create polling configuration with device-specific defaults
   * 6. Create domain aggregate
   * 7. Optionally activate if requested
   * 8. Optionally perform ping test
   * 9. Persist aggregate
   * 10. Convert to response DTO
   */
  protected async executeImpl(
    request: CreateNetworkDeviceDTO
  ): Promise<Result<NetworkDeviceResponseDTO>> {
    const data = NetworkDeviceMapper.extractCreateData(request);

    const validation = this.validateCreateData(data);
    if (validation.isFailure) {
      return this.fail(validation.error!);
    }

    const ipAddress = IPAddress.create(data.ipAddress).value;
    const macAddress = MACAddress.create(data.macAddress).value;

    // REQ-002: deviceType is optional in DRAFT mode, required in ACTIVE mode
    const deviceType = data.deviceType
      ? this.mapDeviceType(data.deviceType)
      : NetworkDeviceType.createUnknown(); // Default for DRAFT

    const connectivityType = data.connectivityType
      ? this.mapConnectivityType(data.connectivityType)
      : ConnectivityType.createEthernet(); // Default

    const managementProtocol = data.managementProtocol
      ? this.mapManagementProtocol(data.managementProtocol)
      : ManagementProtocol.createIcmp(); // Default
    // Business logic: Polling interval depends on device type
    const defaultIntervalSeconds =
      this.getDefaultPollingInterval(deviceType);

    const pollingInterval = PollingInterval.create(
      defaultIntervalSeconds
    );
    if (pollingInterval.isFailure) {
      return this.fail(pollingInterval.error!);
    }

    const networkDeviceId = NetworkDeviceId.create();
    if (networkDeviceId.isFailure) {
      return this.fail(networkDeviceId.error!);
    }

    const pollingConfigurationId = PollingConfigurationId.create();
    if (pollingConfigurationId.isFailure) {
      return this.fail(pollingConfigurationId.error!);
    }

    const pollingConfig = PollingConfiguration.createDefault(
      networkDeviceId.value,
      pollingConfigurationId.value,
      pollingInterval.value
    );
    if (pollingConfig.isFailure) {
      return this.fail(pollingConfig.error!);
    }

    // Business rule: Polling disabled by default
    const disableResult = pollingConfig.value.disable();
    if (disableResult.isFailure) {
      return this.fail(disableResult.error!);
    }

    const deviceResult = NetworkDevice.create(
      {
        name: data.name ?? 'unknown', // REQ-002: Optional in DRAFT mode
        deviceType,
        status: NetworkDeviceStatus.createOffline(), // Business rule: starts offline
        description: data.description ?? null,
        ipAddress,
        macAddress,
        connectivityType,
        managementProtocol,
        managementPort: data.managementPort ?? 161, // Default SNMP port
        enabledRemoteAccess: data.enabledRemoteAccess ?? false,
        deviceId: data.deviceId,
        pollingConfiguration: pollingConfig.value,
        installDate: data.installDate
          ? new Date(data.installDate)
          : new Date(),
        activationStatus: ActivationStatus.DRAFT,
        activatedAt: null,
        activatedBy: null,
        deletedAt: null,
        deletedBy: null,
        replacedByDeviceId: null,
        replacedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      networkDeviceId.value
    );

    if (deviceResult.isFailure) {
      return this.fail(deviceResult.error!);
    }

    const device = deviceResult.value;

    if (data.activateImmediately) {
      // TODO: Get activatedBy from authentication context
      const activatedBy = 'system:admin'; // Placeholder

      const activateResult = device.activate(activatedBy);
      if (activateResult.isFailure) {
        return this.fail(
          `Failed to activate device: ${activateResult.error}`
        );
      }
    }

    if (data.performPingTest) {
      await this.performPingTest(device.ipAddress.toString());
    }

    const saveResult = await this.deviceRepository.save(device);
    if (saveResult.isFailure) {
      return this.fail(saveResult.error!);
    }

    // Repository dispatches domain events automatically
    const responseDTO = NetworkDeviceMapper.toDTO(saveResult.value);

    return this.ok(responseDTO);
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Validates business rules for create data.
   * REQ-002: Conditional validation based on activation mode.
   *
   * DRAFT mode: Only IP, MAC, deviceId required
   * ACTIVE mode: Also requires name and deviceType
   */
  private validateCreateData(
    data: ExtractedCreateData
  ): Result<void> {
    // Always required fields (both DRAFT and ACTIVE)

    if (!data.deviceId) {
      return Result.fail('Device ID is required');
    }

    // REQ-002: Conditional validation for ACTIVE mode
    if (data.activateImmediately) {
      if (!data.name || data.name.trim() === '') {
        return Result.fail(
          'Device name is required when activateImmediately is true'
        );
      }
      if (!data.deviceType) {
        return Result.fail(
          'Device type is required when activateImmediately is true'
        );
      }
    }

    if (data.installDate) {
      const installDate = new Date(data.installDate);
      if (isNaN(installDate.getTime())) {
        return Result.fail('Invalid install date format');
      }
    }

    return Result.ok();
  }

  /**
   * Maps string device type to domain enum.
   * Business logic: Determines device classification from API input.
   */
  private mapDeviceType(typeStr: string): NetworkDeviceType {
    const upperType = typeStr.toUpperCase();
    switch (upperType) {
      case 'ROUTER':
        return NetworkDeviceType.createRouter();
      case 'SWITCH':
        return NetworkDeviceType.createSwitch();
      case 'ACCESS_POINT':
      case 'AP':
        return NetworkDeviceType.createAccessPoint();
      case 'STATION':
        return NetworkDeviceType.createStation();
      case 'PTP_RADIO':
        return NetworkDeviceType.createPtpRadio();
      case 'PTMP_RADIO':
        return NetworkDeviceType.createPtmpRadio();
      case 'FIREWALL':
        return NetworkDeviceType.createFirewall();
      case 'SERVER':
        return NetworkDeviceType.createServer();
      default:
        return NetworkDeviceType.createUnknown();
    }
  }

  /**
   * Maps string connectivity type to domain enum.
   * Business logic: Determines network connectivity classification.
   */
  private mapConnectivityType(typeStr: string): ConnectivityType {
    const upperType = typeStr.toUpperCase();
    switch (upperType) {
      case 'ETHERNET':
        return ConnectivityType.createEthernet();
      case 'FIBER_OPTIC':
      case 'FIBER':
        return ConnectivityType.createFiberOptic();
      case 'WIRELESS':
      case 'WIFI':
        return ConnectivityType.createWireless();
      case 'DSL':
        return ConnectivityType.createDsl();
      case 'SATELLITE':
        return ConnectivityType.createSatellite();
      default:
        return ConnectivityType.createOther();
    }
  }

  /**
   * Maps string management protocol to domain enum.
   * Business logic: Determines device management protocol.
   */
  private mapManagementProtocol(
    protocolStr: string
  ): ManagementProtocol {
    const upperProtocol = protocolStr.toUpperCase();
    switch (upperProtocol) {
      case 'SNMP':
        return ManagementProtocol.createSnmp();
      case 'SSH':
        return ManagementProtocol.createSsh();
      case 'TELNET':
        return ManagementProtocol.createTelnet();
      case 'HTTP':
        return ManagementProtocol.createHttp();
      case 'HTTPS':
        return ManagementProtocol.createHttps();
      case 'ICMP':
        return ManagementProtocol.createIcmp();
      default:
        return ManagementProtocol.createOther();
    }
  }

  /**
   * Gets default polling interval based on device type.
   * Business logic: Different device types have different monitoring needs.
   *
   * - ACCESS_POINT: 30 seconds (frequent monitoring)
   * - STATION: 300 seconds (5 minutes, less critical)
   * - ROUTER/SWITCH/FIREWALL: 60 seconds (standard monitoring)
   * - Others: 60 seconds (default)
   */
  private getDefaultPollingInterval(
    deviceType: NetworkDeviceType
  ): number {
    switch (deviceType.toString()) {
      case NetworkDeviceType.ACCESS_POINT:
        return 30; // Frequent monitoring for APs
      case NetworkDeviceType.STATION:
        return 300; // 5 minutes for stations
      case NetworkDeviceType.ROUTER:
      case NetworkDeviceType.SWITCH:
      case NetworkDeviceType.FIREWALL:
        return 60; // Standard 1-minute interval
      default:
        return 60; // Default interval
    }
  }

  /**
   * Performs optional ping test during device creation.
   * Non-blocking: logs warning if ping fails but continues creation.
   */
  private async performPingTest(ipAddress: string): Promise<void> {
    try {
      // TODO: Implement actual ping logic using ping utility
      this.logger.info(`Ping test requested for ${ipAddress}`, {
        note: 'Ping utility not yet implemented'
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(`Ping test failed for ${ipAddress}`, {
        error: errorMessage,
        note: 'Device will still be created'
      });
    }
  }

  /**
   * Sanitize sensitive data from logs.
   * Override base class method to remove verbose fields.
   */
  protected sanitizeForLogging(data: any): any {
    if (!data) return data;

    // Remove potentially verbose fields
    const sanitized = { ...data };
    delete sanitized.deviceId; // Internal reference, verbose but not sensitive

    return sanitized;
  }
}
