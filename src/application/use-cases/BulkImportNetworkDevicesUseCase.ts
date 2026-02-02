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
  NetworkDeviceId,
  ActivationStatus
} from '../../domain';
import {
  UseCase,
  ILogger,
  BulkImportResponseDTO,
  BulkImportRequestDTO,
  CSVValidationError,
  CSVDeviceRow
} from '../';
/**
 * BulkImportNetworkDevicesUseCase
 *
 * REQ-002 (FR-002.7): Bulk create network devices from CSV file.
 *
 * Features:
 * - Accepts CSV with header row
 * - Required columns: ipAddress, macAddress
 * - Optional columns: name, deviceType, description, location, connectivityType,
 *   managementProtocol, managementPort, enabledRemoteAccess
 * - All-or-nothing transaction: entire import succeeds or fails as unit
 * - Pre-import validation of all rows before any database changes
 * - Maximum 1,000 devices per import (NFR-002.3)
 * - Target: Complete within 30 seconds for 1,000 devices
 *
 * Validation Strategy:
 * 1. Parse CSV to array of raw records
 * 2. Validate ALL records (format, business rules, uniqueness)
 * 3. If ANY validation fails, return detailed error report
 * 4. If ALL valid, create domain aggregates
 * 5. Save all in single transaction
 *
 * Error Reporting:
 * - Row number (1-indexed, excluding header)
 * - Field name
 * - Validation error message
 * - Problematic value
 *
 * @example
 * ```typescript
 * const result = await useCase.execute({
 *   csvData: [
 *     { ipAddress: '192.168.1.1', macAddress: 'AA:BB:CC:DD:EE:FF', name: 'Router-1' },
 *     { ipAddress: '192.168.1.2', macAddress: 'AA:BB:CC:DD:EE:FE', name: 'Switch-1' }
 *   ],
 *   activateImmediately: false
 * });
 * ```
 */
export class BulkImportNetworkDevicesUseCase extends UseCase<
  BulkImportRequestDTO,
  BulkImportResponseDTO
> {
  constructor(
    private readonly deviceRepository: INetworkDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'BulkImportNetworkDevicesUseCase');
  }

  protected async beforeExecute(
    request: BulkImportRequestDTO
  ): Promise<Result<void> | null> {
    // Validate CSV data exists
    if (!request.csvData || !Array.isArray(request.csvData)) {
      return this.fail<void>(
        'CSV data is required and must be an array'
      );
    }

    return null;
  }

  protected async executeImpl(
    request: BulkImportRequestDTO
  ): Promise<Result<BulkImportResponseDTO>> {
    const startTime = performance.now();
    const validationErrors: CSVValidationError[] = [];
    const activateImmediately = request.activateImmediately ?? false;

    // REQ-002: Validate CSV is not empty
    if (request.csvData.length === 0) {
      return this.ok<BulkImportResponseDTO>({
        success: false,
        created: 0,
        failed: 0,
        deviceIds: [],
        validationErrors: [
          {
            row: 0,
            field: 'csvData',
            value: '',
            error: 'CSV data is empty. No devices to import.'
          }
        ],
        duration: performance.now() - startTime
      });
    }

    // REQ-002: Maximum 1,000 devices per import
    if (request.csvData.length > 1000) {
      return this.ok<BulkImportResponseDTO>({
        success: false,
        created: 0,
        failed: request.csvData.length,
        deviceIds: [],
        validationErrors: [
          {
            row: 0,
            field: 'csvData',
            value: `${request.csvData.length} rows`,
            error: `CSV contains ${request.csvData.length} rows. Maximum 1,000 devices per import. Please split into multiple batches.`
          }
        ],
        duration: performance.now() - startTime
      });
    }

    // Step 1: Validate ALL rows before creating any devices
    this.logger.info(
      `Validating ${request.csvData.length} CSV rows...`
    );

    for (let i = 0; i < request.csvData.length; i++) {
      const row = request.csvData[i];
      const rowNumber = i + 1; // 1-indexed

      const rowErrors = this.validateRow(row, rowNumber, activateImmediately);
      validationErrors.push(...rowErrors);
    }

    // If any validation errors, return them without creating devices
    if (validationErrors.length > 0) {
      return this.ok<BulkImportResponseDTO>({
        success: false,
        created: 0,
        failed: request.csvData.length,
        deviceIds: [],
        validationErrors,
        duration: performance.now() - startTime
      });
    }

    // Step 2: Check for duplicate IP/MAC addresses within CSV
    const ipSet = new Set<string>();
    const macSet = new Set<string>();

    for (let i = 0; i < request.csvData.length; i++) {
      const row = request.csvData[i];
      const rowNumber = i + 1;

      if (ipSet.has(row.ipAddress)) {
        validationErrors.push({
          row: rowNumber,
          field: 'ipAddress',
          value: row.ipAddress,
          error: `duplicate IP address within CSV (first occurrence at different row)`
        });
      } else {
        ipSet.add(row.ipAddress);
      }

      if (macSet.has(row.macAddress)) {
        validationErrors.push({
          row: rowNumber,
          field: 'macAddress',
          value: row.macAddress,
          error: `duplicate MAC address within CSV (first occurrence at different row)`
        });
      } else {
        macSet.add(row.macAddress);
      }
    }

    if (validationErrors.length > 0) {
      return this.ok<BulkImportResponseDTO>({
        success: false,
        created: 0,
        failed: request.csvData.length,
        deviceIds: [],
        validationErrors,
        duration: performance.now() - startTime
      });
    }

    // Step 3: Check uniqueness against existing devices
    for (let i = 0; i < request.csvData.length; i++) {
      const row = request.csvData[i];
      const rowNumber = i + 1;

      const ipAddress = IPAddress.create(row.ipAddress);
      if (ipAddress.isSuccess) {
        const ipExists =
          await this.deviceRepository.existsByIpAddress(
            ipAddress.value
          );
        if (ipExists?.isSuccess && ipExists.value) {
          validationErrors.push({
            row: rowNumber,
            field: 'ipAddress',
            value: row.ipAddress,
            error: `IP address already exists in database`
          });
        }
      }

      const macAddress = MACAddress.create(row.macAddress);
      if (macAddress.isSuccess) {
        const macExists =
          await this.deviceRepository.existsByMacAddress(
            macAddress.value
          );
        if (macExists?.isSuccess && macExists.value) {
          validationErrors.push({
            row: rowNumber,
            field: 'macAddress',
            value: row.macAddress,
            error: `MAC address already exists in database`
          });
        }
      }
    }

    if (validationErrors.length > 0) {
      return this.ok<BulkImportResponseDTO>({
        success: false,
        created: 0,
        failed: request.csvData.length,
        deviceIds: [],
        validationErrors,
        duration: performance.now() - startTime
      });
    }

    // Step 4: Create domain aggregates
    this.logger.info(
      'All validations passed. Creating domain aggregates...'
    );
    const devices: NetworkDevice[] = [];

    for (const row of request.csvData) {
      const deviceResult = await this.createDeviceFromRow(
        row,
        request.activateImmediately ?? false
      );

      if (deviceResult.isFailure) {
        // This shouldn't happen if validation passed, but handle defensively
        return this.fail<BulkImportResponseDTO>(
          `Unexpected error creating device: ${deviceResult.error}`
        );
      }

      devices.push(deviceResult.value);
    }

    // Step 5: Save all devices in single transaction
    this.logger.info(
      `Saving ${devices.length} devices in transaction...`
    );
    const saveResult = await this.deviceRepository.saveMany(devices);

    if (saveResult.isFailure) {
      return this.fail<BulkImportResponseDTO>(
        `Failed to save devices: ${saveResult.error}`
      );
    }

    const deviceIds = devices.map((d) => d.id.toString());

    return this.ok<BulkImportResponseDTO>({
      success: true,
      created: devices.length,
      failed: 0,
      deviceIds,
      duration: performance.now() - startTime
    });
  }

  /**
   * Validates a single CSV row.
   * Returns array of validation errors (empty if valid).
   *
   * @private
   */
  private validateRow(
    row: CSVDeviceRow,
    rowNumber: number,
    activateImmediately: boolean
  ): CSVValidationError[] {
    const errors: CSVValidationError[] = [];

    // Business rule: name is required in ACTIVE mode
    if (activateImmediately && (!row.name || row.name.trim() === '')) {
      errors.push({
        row: rowNumber,
        field: 'name',
        value: row.name ?? '',
        error: 'name is required when activating immediately'
      });
    }

    // Business rule: deviceType is required in ACTIVE mode
    if (activateImmediately && (!row.deviceType || row.deviceType.trim() === '')) {
      errors.push({
        row: rowNumber,
        field: 'deviceType',
        value: row.deviceType ?? '',
        error: 'deviceType is required when activating immediately'
      });
    }

    // Required: ipAddress
    if (!row.ipAddress || row.ipAddress.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'ipAddress',
        value: row.ipAddress,
        error: 'IP address is required'
      });
    } else {
      const ipResult = IPAddress.create(row.ipAddress.trim());
      if (ipResult.isFailure) {
        errors.push({
          row: rowNumber,
          field: 'ipAddress',
          value: row.ipAddress,
          error: `Invalid IP address: ${ipResult.error}`
        });
      }
    }

    // Required: macAddress
    if (!row.macAddress || row.macAddress.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'macAddress',
        value: row.macAddress,
        error: 'MAC address is required'
      });
    } else {
      const macResult = MACAddress.create(row.macAddress.trim());
      if (macResult.isFailure) {
        errors.push({
          row: rowNumber,
          field: 'macAddress',
          value: row.macAddress,
          error: `Invalid MAC address: ${macResult.error}`
        });
      }
    }

    // Optional: name (max 255 characters)
    if (row.name && row.name.trim().length > 255) {
      errors.push({
        row: rowNumber,
        field: 'name',
        value: row.name,
        error: `Name must not exceed 255 characters (current: ${row.name.length})`
      });
    }

    // Optional: description (max 1000 characters)
    if (row.description && row.description.length > 1000) {
      errors.push({
        row: rowNumber,
        field: 'description',
        value: row.description.substring(0, 50) + '...',
        error: `Description must not exceed 1000 characters (current: ${row.description.length})`
      });
    }

    // Optional: deviceType (valid enum)
    if (row.deviceType) {
      const upperType = row.deviceType.toUpperCase();
      if (NetworkDeviceType.isValid(upperType) === false) {
        errors.push({
          row: rowNumber,
          field: 'deviceType',
          value: row.deviceType,
          error: `Invalid device type. Must be one of: ${NetworkDeviceType.validTypes().join(', ')}`
        });
      }
    }

    // Optional: connectivityType (valid enum)
    if (row.connectivityType) {
      const upperType = row.connectivityType.toUpperCase();
      if (ConnectivityType.isValid(upperType) === false) {
        errors.push({
          row: rowNumber,
          field: 'connectivityType',
          value: row.connectivityType,
          error: `Invalid connectivity type. Must be one of: ${ConnectivityType.validTypes().join(', ')}`
        });
      }
    }

    // Optional: managementProtocol (valid enum)
    if (row.managementProtocol) {
      const upperProtocol = row.managementProtocol.toUpperCase();
      if (ManagementProtocol.isValid(upperProtocol) === false) {
        errors.push({
          row: rowNumber,
          field: 'managementProtocol',
          value: row.managementProtocol,
          error: `Invalid management protocol. Must be one of: ${ManagementProtocol.validProtocols().join(', ')}`
        });
      }
    }

    // Optional: managementPort (integer 1-65535)
    if (row.managementPort) {
      const port = Number(row.managementPort);
      if (
        isNaN(port) ||
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535
      ) {
        errors.push({
          row: rowNumber,
          field: 'managementPort',
          value: row.managementPort,
          error:
            'Management port must be an integer between 1 and 65535'
        });
      }
    }

    // Optional: enabledRemoteAccess (boolean)
    if (row.enabledRemoteAccess) {
      const lowerValue = row.enabledRemoteAccess.toLowerCase();
      if (
        !['true', 'false', '1', '0', 'yes', 'no'].includes(lowerValue)
      ) {
        errors.push({
          row: rowNumber,
          field: 'enabledRemoteAccess',
          value: row.enabledRemoteAccess,
          error:
            'Remote access must be a boolean (true/false, 1/0, yes/no)'
        });
      }
    }

    return errors;
  }

  /**
   * Creates a NetworkDevice from CSV row.
   *
   * @private
   */
  private async createDeviceFromRow(
    row: CSVDeviceRow,
    activateImmediately: boolean
  ): Promise<Result<NetworkDevice>> {
    // Create value objects
    const ipAddress = IPAddress.create(row.ipAddress.trim());
    const macAddress = MACAddress.create(row.macAddress.trim());

    if (ipAddress.isFailure || macAddress.isFailure) {
      return Result.fail<NetworkDevice>('Invalid IP or MAC address');
    }

    // Map enums
    const deviceType = row.deviceType
      ? NetworkDeviceType.create(row.deviceType).value
      : NetworkDeviceType.createUnknown();
    const connectivityType = row.connectivityType
      ? ConnectivityType.create(row.connectivityType).value
      : ConnectivityType.createEthernet();
    const managementProtocol = row.managementProtocol
      ? ManagementProtocol.create(row.managementProtocol).value
      : ManagementProtocol.createIcmp();

    // Parse optional fields
    const managementPort = row.managementPort
      ? Number(row.managementPort)
      : managementProtocol.getDefaultPort();
    const enabledRemoteAccess = row.enabledRemoteAccess
      ? this.parseBoolean(row.enabledRemoteAccess)
      : false;

    // Create polling configuration
    const defaultIntervalSeconds =
      deviceType.getDefaultPollingInterval();
    const pollingInterval = PollingInterval.create(
      defaultIntervalSeconds
    );
    if (pollingInterval.isFailure) {
      return Result.fail<NetworkDevice>(pollingInterval.error!);
    }

    const networkDeviceId = NetworkDeviceId.create();
    if (networkDeviceId.isFailure) {
      return Result.fail<NetworkDevice>(networkDeviceId.error!);
    }

    const pollingDeviceId = NetworkDeviceId.create();
    if (pollingDeviceId.isFailure) {
      return Result.fail<NetworkDevice>(pollingDeviceId.error!);
    }

    const pollingConfig = PollingConfiguration.createDefault(
      networkDeviceId.value,
      pollingDeviceId.value,
      pollingInterval.value
    );
    if (pollingConfig.isFailure) {
      return Result.fail<NetworkDevice>(pollingConfig.error!);
    }

    pollingConfig.value.disable(); // Disabled by default

    // Create device
    const deviceResult = NetworkDevice.create(
      {
        name: row.name?.trim() ?? 'unknown',
        deviceType,
        status: NetworkDeviceStatus.createOffline(), // Start offline
        description: row.description ?? null,
        ipAddress: ipAddress.value,
        macAddress: macAddress.value,
        connectivityType,
        managementProtocol,
        managementPort,
        enabledRemoteAccess,
        deviceId:
          row.deviceId ??
          `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pollingConfiguration: pollingConfig.value,
        installDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        activationStatus: ActivationStatus.DRAFT,
        activatedAt: null,
        activatedBy: null,
        deletedAt: null,
        deletedBy: null,
        replacedByDeviceId: null,
        replacedAt: null
      },
      networkDeviceId.value
    );

    if (deviceResult.isFailure) {
      return Result.fail<NetworkDevice>(deviceResult.error!);
    }

    const device = deviceResult.value;

    // Activate if requested
    if (activateImmediately) {
      const activatedBy = 'system:bulk-import'; // TODO: Get from auth context
      const activateResult = device.activate(activatedBy);
      if (activateResult.isFailure) {
        return Result.fail<NetworkDevice>(
          `Failed to activate device: ${activateResult.error}`
        );
      }
    }

    return Result.ok<NetworkDevice>(device);
  }

  private parseBoolean(value: string): boolean {
    const lowerValue = value.toLowerCase();
    return ['true', '1', 'yes'].includes(lowerValue);
  }
}
