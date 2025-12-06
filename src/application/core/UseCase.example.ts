/**
 * UseCase Base Class - Usage Examples
 *
 * This file demonstrates how to use the UseCase base class to implement
 * concrete use cases in the application layer.
 *
 * DO NOT IMPORT THIS FILE IN PRODUCTION CODE - IT'S FOR DOCUMENTATION ONLY
 */

import { Result } from '../../domain/shared/kernel/Result';
import { UseCase } from './UseCase';
import { ILogger } from '../interfaces/ILogger';
import { INetworkDeviceRepository } from '../../domain/repository';
import { NetworkDevice } from '../../domain/entities';
import { IPAddress, MACAddress, NetworkDeviceType, NetworkDeviceStatus } from '../../domain/value-objects';
import { ConnectivityType, ManagementProtocol } from '../../domain/entities/NetworkDevice';

// ============================================================================
// EXAMPLE 1: Simple Query Use Case
// ============================================================================

/**
 * Request DTO for getting a device by IP address
 */
interface GetDeviceByIpRequest {
  ipAddress: string;
}

/**
 * Response DTO for device query
 */
interface GetDeviceByIpResponse {
  deviceId: string;
  name: string;
  ipAddress: string;
  status: NetworkDeviceStatus;
}

/**
 * Example Query Use Case - Retrieves a device by IP address
 *
 * This is a simple read-only use case that:
 * - Validates the IP address
 * - Queries the repository
 * - Maps the domain entity to a response DTO
 */
class GetDeviceByIpUseCase extends UseCase<
  GetDeviceByIpRequest,
  GetDeviceByIpResponse
> {
  constructor(
    private readonly deviceRepository: INetworkDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'GetDeviceByIpUseCase');
  }

  /**
   * Main use case logic
   */
  protected async executeImpl(
    request: GetDeviceByIpRequest
  ): Promise<Result<GetDeviceByIpResponse>> {
    // 1. Validate and create value objects
    const ipAddressOrError = IPAddress.create(request.ipAddress);
    if (ipAddressOrError.isFailure) {
      return this.fail(ipAddressOrError.error!);
    }

    const ipAddress = ipAddressOrError.getValue();

    // 2. Query repository
    const deviceOrError = await this.deviceRepository.findByIpAddress(ipAddress);
    if (deviceOrError.isFailure) {
      return this.fail(deviceOrError.error!);
    }

    const device = deviceOrError.getValue();
    if (!device) {
      return this.fail(`Device with IP ${request.ipAddress} not found`);
    }

    // 3. Map to response DTO
    const response: GetDeviceByIpResponse = {
      deviceId: device.networkDeviceId.toString(),
      name: device.name,
      ipAddress: device.ipAddress.toString(),
      status: device.status
    };

    return this.ok(response);
  }

  /**
   * Override to sanitize sensitive data before logging
   */
  protected sanitizeForLogging(data: any): any {
    // In this case, no sensitive data, so return as-is
    return data;
  }
}

// ============================================================================
// EXAMPLE 2: Command Use Case with Validation
// ============================================================================

/**
 * Request DTO for creating a new network device
 */
interface CreateNetworkDeviceRequest {
  name: string;
  deviceType: NetworkDeviceType;
  ipAddress: string;
  macAddress: string;
  description?: string;
  connectivityType: ConnectivityType;
  managementProtocol: ManagementProtocol;
  managementPort: number;
  deviceId: string; // Reference to parent Device entity
}

/**
 * Response DTO for device creation
 */
interface CreateNetworkDeviceResponse {
  deviceId: string;
  name: string;
  ipAddress: string;
}

/**
 * Example Command Use Case - Creates a new network device
 *
 * This use case demonstrates:
 * - Input validation in beforeExecute
 * - Complex domain object creation
 * - Repository persistence
 * - Event handling (implicit via aggregate)
 */
class CreateNetworkDeviceUseCase extends UseCase<
  CreateNetworkDeviceRequest,
  CreateNetworkDeviceResponse
> {
  constructor(
    private readonly deviceRepository: INetworkDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'CreateNetworkDeviceUseCase');
  }

  /**
   * Pre-execution validation hook
   */
  protected async beforeExecute(
    request: CreateNetworkDeviceRequest
  ): Promise<Result<void> | null> {
    // Validate IP address doesn't already exist
    const ipAddressOrError = IPAddress.create(request.ipAddress);
    if (ipAddressOrError.isFailure) {
      return Result.fail<void>(`Invalid IP address: ${ipAddressOrError.error}`);
    }

    const ipExists = await this.deviceRepository.existsByIpAddress(
      ipAddressOrError.getValue()
    );

    if (ipExists.isFailure) {
      return Result.fail<void>(ipExists.error!);
    }

    if (ipExists.getValue()) {
      return Result.fail<void>(
        `Device with IP ${request.ipAddress} already exists`
      );
    }

    // Validate MAC address doesn't already exist
    const macAddressOrError = MACAddress.create(request.macAddress);
    if (macAddressOrError.isFailure) {
      return Result.fail<void>(`Invalid MAC address: ${macAddressOrError.error}`);
    }

    const macExists = await this.deviceRepository.existsByMacAddress(
      macAddressOrError.getValue()
    );

    if (macExists.isFailure) {
      return Result.fail<void>(macExists.error!);
    }

    if (macExists.getValue()) {
      return Result.fail<void>(
        `Device with MAC ${request.macAddress} already exists`
      );
    }

    return null; // Validation passed
  }

  /**
   * Main use case logic
   */
  protected async executeImpl(
    request: CreateNetworkDeviceRequest
  ): Promise<Result<CreateNetworkDeviceResponse>> {
    // 1. Create value objects
    const ipAddressOrError = IPAddress.create(request.ipAddress);
    const macAddressOrError = MACAddress.create(request.macAddress);

    // Combine validation results
    const combinedResult = Result.combine([
      ipAddressOrError,
      macAddressOrError
    ]);

    if (combinedResult.isFailure) {
      return this.fail(combinedResult.error!);
    }

    const ipAddress = ipAddressOrError.getValue();
    const macAddress = macAddressOrError.getValue();

    // 2. Create NetworkDevice aggregate
    const networkDeviceOrError = NetworkDevice.create({
      name: request.name,
      deviceType: request.deviceType,
      status: NetworkDeviceStatus.OFFLINE, // New devices start offline
      description: request.description || null,
      installDate: new Date(),
      ipAddress,
      macAddress,
      connectivityType: request.connectivityType,
      managementProtocol: request.managementProtocol,
      managementPort: request.managementPort,
      enabledRemoteAccess: false,
      deviceId: request.deviceId,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    if (networkDeviceOrError.isFailure) {
      return this.fail(networkDeviceOrError.error!);
    }

    const networkDevice = networkDeviceOrError.getValue();

    // 3. Persist to repository
    const savedDeviceOrError = await this.deviceRepository.save(networkDevice);

    if (savedDeviceOrError.isFailure) {
      return this.fail(
        `Failed to save device: ${savedDeviceOrError.error}`
      );
    }

    const savedDevice = savedDeviceOrError.getValue();

    // 4. Map to response DTO
    const response: CreateNetworkDeviceResponse = {
      deviceId: savedDevice.networkDeviceId.toString(),
      name: savedDevice.name,
      ipAddress: savedDevice.ipAddress.toString()
    };

    return this.ok(response);
  }

  /**
   * Post-execution hook - could publish events, invalidate cache, etc.
   */
  protected async afterExecute(
    request: CreateNetworkDeviceRequest,
    response: CreateNetworkDeviceResponse
  ): Promise<Result<void> | null> {
    // In a real implementation, you might:
    // - Publish domain events
    // - Invalidate cache
    // - Send notifications
    // - Trigger background jobs (e.g., start polling the device)

    this.logger.info('Network device created successfully', {
      deviceId: response.deviceId,
      ipAddress: response.ipAddress
    });

    return null;
  }

  /**
   * Sanitize sensitive data before logging
   */
  protected sanitizeForLogging(data: any): any {
    if (!data) return data;

    // Remove any sensitive fields if they exist
    const sanitized = { ...data };

    // Example: if there were credentials, we'd remove them
    // delete sanitized.password;
    // delete sanitized.apiKey;

    return sanitized;
  }
}

// ============================================================================
// EXAMPLE 3: Use Case with Custom Error Handling
// ============================================================================

/**
 * Request DTO for updating device status
 */
interface UpdateDeviceStatusRequest {
  deviceId: string;
  newStatus: NetworkDeviceStatus;
}

/**
 * Response DTO for status update
 */
interface UpdateDeviceStatusResponse {
  deviceId: string;
  previousStatus: NetworkDeviceStatus;
  newStatus: NetworkDeviceStatus;
  updatedAt: Date;
}

/**
 * Example Command Use Case - Updates device status
 *
 * Demonstrates:
 * - Using domain methods to enforce business rules
 * - Domain events (emitted by aggregate)
 * - Custom error messages
 */
class UpdateDeviceStatusUseCase extends UseCase<
  UpdateDeviceStatusRequest,
  UpdateDeviceStatusResponse
> {
  constructor(
    private readonly deviceRepository: INetworkDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateDeviceStatusUseCase');
  }

  protected async executeImpl(
    request: UpdateDeviceStatusRequest
  ): Promise<Result<UpdateDeviceStatusResponse>> {
    // 1. Find the device
    const deviceIdOrError = IPAddress.create(request.deviceId);
    // Note: This is simplified - you'd actually use NetworkDeviceId.create()

    const deviceOrError = await this.deviceRepository.findById(
      new (await import('../../domain/entities/NetworkDeviceId')).NetworkDeviceId(
        request.deviceId
      )
    );

    if (deviceOrError.isFailure) {
      return this.fail(deviceOrError.error!);
    }

    const device = deviceOrError.getValue();
    if (!device) {
      return this.fail(`Device ${request.deviceId} not found`);
    }

    // 2. Store previous status
    const previousStatus = device.status;

    // 3. Update status using domain method (enforces business rules)
    const updateResult = device.updateStatus(request.newStatus);

    if (updateResult.isFailure) {
      return this.fail(updateResult.error!);
    }

    // 4. Persist changes
    const savedDeviceOrError = await this.deviceRepository.save(device);

    if (savedDeviceOrError.isFailure) {
      return this.fail(`Failed to save status update: ${savedDeviceOrError.error}`);
    }

    // 5. Return response
    const response: UpdateDeviceStatusResponse = {
      deviceId: device.networkDeviceId.toString(),
      previousStatus,
      newStatus: device.status,
      updatedAt: device.updatedAt
    };

    return this.ok(response);
  }
}

// ============================================================================
// USAGE IN APPLICATION
// ============================================================================

/**
 * Example of how to use the use case in a controller or service
 */
async function exampleUsage(
  deviceRepository: INetworkDeviceRepository,
  logger: ILogger
) {
  // 1. Instantiate the use case
  const getDeviceUseCase = new GetDeviceByIpUseCase(deviceRepository, logger);

  // 2. Prepare the request
  const request: GetDeviceByIpRequest = {
    ipAddress: '192.168.1.1'
  };

  // 3. Execute the use case
  const result = await getDeviceUseCase.execute(request);

  // 4. Handle the result
  if (result.isFailure) {
    console.error('Failed to get device:', result.error);
    return;
  }

  const device = result.getValue();
  console.log('Device found:', device);
}

// ============================================================================
// KEY TAKEAWAYS
// ============================================================================

/**
 * 1. Use Cases are thin orchestration layers that coordinate domain objects
 *
 * 2. All business logic should be in the domain layer (entities, value objects)
 *
 * 3. Use Cases should:
 *    - Validate input
 *    - Load aggregates from repositories
 *    - Call domain methods
 *    - Persist changes
 *    - Return DTOs (never domain objects)
 *
 * 4. The UseCase base class provides:
 *    - Consistent error handling
 *    - Logging
 *    - Pre/post execution hooks
 *    - Template method pattern
 *
 * 5. Use beforeExecute() for:
 *    - Authorization checks
 *    - Complex validation
 *    - Checking preconditions
 *
 * 6. Use afterExecute() for:
 *    - Publishing domain events
 *    - Cache invalidation
 *    - Triggering side effects
 *
 * 7. Always use Result<T> for error handling (no exceptions)
 *
 * 8. Use DTOs for input/output, not domain objects
 */
