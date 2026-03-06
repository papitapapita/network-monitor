import {
  Result,
  NetworkDeviceId,
  ManagementProtocol
} from '../../../domain/device-inventory';
import { INetworkDeviceRepository } from '../../../domain/device-inventory/repository/INetworkDeviceRepository';
import { UseCase } from '../../shared/core/UseCase';
import { ILogger } from '../../shared/interfaces/ILogger';
import {
  UpdateNetworkDeviceDTO,
  NetworkDeviceResponseDTO
} from '../../device-inventory/dtos';
import { NetworkDeviceMapper } from '../mappers/NetworkDeviceMapper';

/**
 * UpdateNetworkDeviceUseCase
 *
 * Updates an existing network device.
 *
 * Flow:
 * 1. beforeExecute: Early check for at least one update field
 * 2. executeImpl: Orchestrate business workflow
 * 3. afterExecute: Events auto-dispatched by repository
 *
 * Immutable Fields (cannot be changed after creation):
 * - IP address (domain constraint)
 * - MAC address (domain constraint)
 * - Device type (no domain method available)
 * - Connectivity type (no domain method available)
 * - Activation status (use ActivateNetworkDeviceUseCase instead)
 *
 * Updatable Fields:
 * - Name (via updateName domain method)
 * - Description (via updateDescription domain method)
 * - Location (via updateLocation domain method) - REQ-002
 * - Management protocol (via updateManagementConfig domain method)
 * - Management port (via updateManagementConfig domain method)
 * - Remote access enabled (via updateManagementConfig domain method)
 *
 * Business Rules:
 * - At least one field must be provided for update
 * - Name must not be empty and max 255 characters
 * - Description max 1000 characters
 * - Location max 500 characters (REQ-002)
 * - Management port must be between 1-65535
 * - Cannot update soft-deleted devices
 *
 * Business Orchestration:
 * - Validates business rules
 * - Validates immutable field constraints
 * - Maps enum strings to domain enums (business logic)
 * - Calls domain aggregate methods (updateName, updateDescription, updateLocation, updateManagementConfig)
 * - Handles partial updates (only provided fields)
 *
 * Mapper Responsibility:
 * - Pure data transformation: extracts raw update data from DTO
 * - Converts domain entity to response DTO
 * - NO validation, NO business logic
 */
export interface UpdateNetworkDeviceRequest
  extends UpdateNetworkDeviceDTO {
  id: string;
}

export class UpdateNetworkDeviceUseCase extends UseCase<
  UpdateNetworkDeviceRequest,
  NetworkDeviceResponseDTO
> {
  constructor(
    private readonly deviceRepository: INetworkDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateNetworkDeviceUseCase');
  }

  protected async beforeExecute(
    request: UpdateNetworkDeviceRequest
  ): Promise<Result<void> | null> {
    // Early validation for at least one field - helps avoid DB lookup
    // The mapper will also validate this, but checking here provides early exit
    const hasUpdates =
      request.name ||
      request.description !== undefined ||
      request.location !== undefined || // REQ-002
      request.deviceType ||
      request.connectivityType ||
      request.managementProtocol ||
      request.managementPort !== undefined ||
      request.enabledRemoteAccess !== undefined;

    if (!hasUpdates) {
      return this.fail<void>(
        'At least one field must be provided for update'
      );
    }

    return null;
  }

  protected async executeImpl(
    request: UpdateNetworkDeviceRequest
  ): Promise<Result<NetworkDeviceResponseDTO>> {
    // 1. Validate ID format and find device
    const deviceId = NetworkDeviceId.create(request.id);
    if (deviceId.isFailure) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Invalid device ID: ${deviceId.error}`
      );
    }

    const deviceResult = await this.deviceRepository.findById(
      deviceId.value
    );
    if (deviceResult.isFailure) {
      return this.fail<NetworkDeviceResponseDTO>(deviceResult.error!);
    }

    if (!deviceResult.value) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Network device with ID ${request.id} not found`
      );
    }

    const device = deviceResult.value;

    // REQ-002: Validate device is not soft-deleted
    if (device.deletedAt !== null) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Cannot update soft-deleted device. Restore it first using RestoreNetworkDeviceUseCase.`
      );
    }

    // 2. Extract raw update data from DTO (mapper does NO validation)
    const updates = NetworkDeviceMapper.extractUpdateData(request);

    // 3. Validate business rules for updates
    const validation = this.validateUpdateData(updates);
    if (validation.isFailure) {
      return this.fail<NetworkDeviceResponseDTO>(validation.error!);
    }

    // 4. Validate immutable fields (business rule enforcement)
    if (updates.deviceType !== undefined) {
      return this.fail<NetworkDeviceResponseDTO>(
        'Device type cannot be changed after creation. Create a new device instead.'
      );
    }

    if (updates.connectivityType !== undefined) {
      return this.fail<NetworkDeviceResponseDTO>(
        'Connectivity type cannot be changed after creation. Create a new device instead.'
      );
    }

    // 5. Apply updates using domain methods (business orchestration)

    // Update name if provided
    if (updates.name !== undefined) {
      const updateNameResult = device.updateName(updates.name);
      if (updateNameResult.isFailure) {
        return this.fail<NetworkDeviceResponseDTO>(
          updateNameResult.error!
        );
      }
    }

    // Update description if provided
    if (updates.description !== undefined) {
      const updateDescResult = device.updateDescription(
        updates.description
      );
      if (updateDescResult.isFailure) {
        return this.fail<NetworkDeviceResponseDTO>(
          updateDescResult.error!
        );
      }
    }

    // REQ-002: Update location if provided
    if (updates.location !== undefined) {
      const updateLocationResult = device.updateLocation(
        updates.location
      );
      if (updateLocationResult.isFailure) {
        return this.fail<NetworkDeviceResponseDTO>(
          updateLocationResult.error!
        );
      }
    }

    // Update management configuration if any management fields provided
    if (
      updates.managementProtocol !== undefined ||
      updates.managementPort !== undefined ||
      updates.enabledRemoteAccess !== undefined
    ) {
      // Map management protocol enum (business logic)
      const managementProtocol = updates.managementProtocol
        ? this.mapManagementProtocol(updates.managementProtocol)
        : undefined;

      const updateConfigResult = device.updateManagementConfig({
        protocol: managementProtocol,
        port: updates.managementPort,
        enableRemoteAccess: updates.enabledRemoteAccess
      });

      if (updateConfigResult.isFailure) {
        return this.fail<NetworkDeviceResponseDTO>(
          updateConfigResult.error!
        );
      }
    }

    // 6. Save updated device
    const saveResult = await this.deviceRepository.save(device);
    if (saveResult.isFailure) {
      return this.fail<NetworkDeviceResponseDTO>(saveResult.error!);
    }

    // 7. Convert to DTO for response (mapper responsibility)
    const responseDTO = NetworkDeviceMapper.toDTO(device);
    return this.ok<NetworkDeviceResponseDTO>(responseDTO);
  }

  /**
   * Validates business rules for update data.
   * Business logic, not structural validation.
   * @private
   */
  private validateUpdateData(updates: any): Result<void> {
    // Name validation (if provided)
    if (updates.name !== undefined) {
      if (
        typeof updates.name !== 'string' ||
        updates.name.trim() === ''
      ) {
        return Result.fail<void>('Device name cannot be empty');
      }

      const trimmedName = updates.name.trim();
      if (trimmedName.length > 255) {
        return Result.fail<void>(
          `Device name must not exceed 255 characters (current: ${trimmedName.length})`
        );
      }
    }

    // Description validation (if provided)
    if (
      updates.description !== undefined &&
      updates.description !== null &&
      updates.description.length > 1000
    ) {
      return Result.fail<void>(
        `Description must not exceed 1000 characters (current: ${updates.description.length})`
      );
    }

    // REQ-002: Location validation (if provided)
    if (
      updates.location !== undefined &&
      updates.location !== null &&
      updates.location.length > 500
    ) {
      return Result.fail<void>(
        `Location must not exceed 500 characters (current: ${updates.location.length})`
      );
    }

    // Management port validation (if provided)
    if (updates.managementPort !== undefined) {
      if (
        !Number.isInteger(updates.managementPort) ||
        updates.managementPort < 1 ||
        updates.managementPort > 65535
      ) {
        return Result.fail<void>(
          `Management port must be between 1 and 65535 (current: ${updates.managementPort})`
        );
      }
    }

    return Result.ok<void>(undefined);
  }

  /**
   * Maps management protocol string to enum (business logic).
   * Falls back to OTHER for unrecognized values.
   * @private
   */
  private mapManagementProtocol(
    protocolStr: string
  ): ManagementProtocol {
    const upperProtocol = protocolStr.toUpperCase();
    if (
      Object.values(ManagementProtocol).includes(
        upperProtocol as ManagementProtocol
      )
    ) {
      return upperProtocol as ManagementProtocol;
    }
    return ManagementProtocol.OTHER;
  }
}
