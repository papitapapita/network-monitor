import {
  Result,
  NetworkDeviceId,
  NetworkDeviceType,
  ConnectivityType,
  ManagementProtocol,
  ActivationStatus,
  INetworkDeviceRepository
} from '../../domain';
import {
  UseCase,
  ILogger,
  ActivateNetworkDeviceRequestDTO,
  NetworkDeviceResponseDTO,
  NetworkDeviceMapper
} from '../';

/**
 * ActivateNetworkDeviceUseCase
 *
 * Business Intent: Activate a DRAFT network device to ACTIVE status
 *
 * Flow:
 * 1. beforeExecute: Validate required fields
 * 2. executeImpl: Orchestrate device activation
 * 3. afterExecute: Log operation (automatic via base class)
 *
 * Business Rules:
 * - Device must exist and not be soft-deleted
 * - Device must be in DRAFT status (cannot re-activate ACTIVE device)
 * - Name and deviceType are required for activation
 * - IP and MAC addresses must be unique (checked at domain level)
 * - Sets activatedAt timestamp automatically
 * - Sets activatedBy from request context (TODO: auth integration)
 * - Triggers NetworkDeviceActivatedEvent via domain
 *
 * Requirements:
 * - REQ-002: Activation Workflow (AC-002.2)
 * - REQ-002: Device must be in DRAFT before activation
 * - REQ-002: Activation sets activatedAt and activatedBy
 * - REQ-002: Device transitions to ACTIVE status
 *
 * Dependencies:
 * - INetworkDeviceRepository: Load and persist device aggregate
 * - ILogger: Log operations
 *
 * @example
 * ```typescript
 * const useCase = new ActivateNetworkDeviceUseCase(repository, logger);
 * const result = await useCase.execute({
 *   id: '550e8400-e29b-41d4-a716-446655440000',
 *   name: 'Router-Core-01',
 *   deviceType: 'ROUTER',
 *   description: 'Main core router for building A',
 * });
 * ```
 */
export class ActivateNetworkDeviceUseCase extends UseCase<
  ActivateNetworkDeviceRequestDTO,
  NetworkDeviceResponseDTO
> {
  constructor(
    private readonly deviceRepository: INetworkDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'ActivateNetworkDeviceUseCase');
  }

  /**
   * Pre-execution validation.
   * Checks structural requirements before main execution.
   */
  protected async beforeExecute(
    request: ActivateNetworkDeviceRequestDTO
  ): Promise<Result<void> | null> {
    // Check required fields
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Device ID is required');
    }

    if (!request.name || request.name.trim().length === 0) {
      return Result.fail('Device name is required for activation');
    }

    if (
      !request.deviceType ||
      request.deviceType.trim().length === 0
    ) {
      return Result.fail('Device type is required for activation');
    }

    return null; // Validation passed
  }

  /**
   * Main execution: Orchestrate device activation.
   *
   * Steps:
   * 1. Extract raw data from DTO (Mapper)
   * 2. Validate device ID format
   * 3. Load device aggregate
   * 4. Validate activation preconditions
   * 5. Map string enums to domain enums (Business logic)
   * 6. Enrich device with activation data
   * 7. Activate device (Domain method)
   * 8. Persist updated aggregate
   * 9. Convert to response DTO
   */
  protected async executeImpl(
    request: ActivateNetworkDeviceRequestDTO
  ): Promise<Result<NetworkDeviceResponseDTO>> {
    const data = NetworkDeviceMapper.extractActivateData(request);

    const deviceIdResult = NetworkDeviceId.create(data.id);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }

    const deviceId = deviceIdResult.value;

    const deviceResult =
      await this.deviceRepository.findById(deviceId);
    if (deviceResult.isFailure) {
      return this.fail(`Error loading device: ${deviceResult.error}`);
    }

    if (!deviceResult.value) {
      return this.fail(`Device with ID ${data.id} not found`);
    }

    const device = deviceResult.value;

    // Check device is not soft-deleted
    if (device.deletedAt !== null) {
      return this.fail(
        'Cannot activate a soft-deleted device. Restore it first.'
      );
    }

    // Check device is in DRAFT status
    if (device.activationStatus !== ActivationStatus.DRAFT) {
      return this.fail(
        `Device is already ${device.activationStatus.toString()}. Only DRAFT devices can be activated.`
      );
    }

    const deviceType = this.mapDeviceType(data.deviceType);
    const connectivityType = data.connectivityType
      ? this.mapConnectivityType(data.connectivityType)
      : ConnectivityType.createWireless(); // Default
    const managementProtocol = data.managementProtocol
      ? this.mapManagementProtocol(data.managementProtocol)
      : ManagementProtocol.createIcmp(); // Default

    // Update name (required)
    const nameResult = device.updateName(data.name);
    if (nameResult.isFailure) {
      return this.fail(`Failed to update name: ${nameResult.error}`);
    }

    // Update device type (required)
    const typeResult = device.updateDeviceType(deviceType);
    if (typeResult.isFailure) {
      return this.fail(
        `Failed to update device type: ${typeResult.error}`
      );
    }

    // Update description (optional)
    if (data.description !== null && data.description !== undefined) {
      const descResult = device.updateDescription(data.description);
      if (descResult.isFailure) {
        return this.fail(
          `Failed to update description: ${descResult.error}`
        );
      }
    }

    // Update connectivity type (optional with default)
    const connResult =
      device.updateConnectivityType(connectivityType);
    if (connResult.isFailure) {
      return this.fail(
        `Failed to update connectivity type: ${connResult.error}`
      );
    }

    // Update management protocol (optional with default)
    const protResult = device.updateManagementConfig({
      protocol: managementProtocol
    });
    if (protResult.isFailure) {
      return this.fail(
        `Failed to update management protocol: ${protResult.error}`
      );
    }

    // Update management port (optional)
    if (
      data.managementPort !== null &&
      data.managementPort !== undefined
    ) {
      const portResult = device.updateManagementConfig({
        port: data.managementPort
      });
      if (portResult.isFailure) {
        return this.fail(
          `Failed to update management port: ${portResult.error}`
        );
      }
    }

    // Update remote access (optional)
    if (
      data.enabledRemoteAccess !== null &&
      data.enabledRemoteAccess !== undefined
    ) {
      const remoteResult = device.updateManagementConfig({
        enableRemoteAccess: data.enabledRemoteAccess
      });
      if (remoteResult.isFailure) {
        return this.fail(
          `Failed to update remote access: ${remoteResult.error}`
        );
      }
    }

    // TODO: Get activatedBy from authentication context
    const activatedBy = 'system:admin'; // Placeholder

    const activateResult = device.activate(activatedBy);
    if (activateResult.isFailure) {
      return this.fail(
        `Failed to activate device: ${activateResult.error}`
      );
    }

    const saveResult = await this.deviceRepository.save(device);
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to save activated device: ${saveResult.error}`
      );
    }

    // Repository dispatches NetworkDeviceActivatedEvent automatically

    const responseDTO = NetworkDeviceMapper.toDTO(saveResult.value);

    return this.ok(responseDTO);
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
}
