import {
  Result,
  NetworkDevice,
  NetworkDeviceId
} from '../../../domain/device-inventory';
import { INetworkDeviceRepository } from '../../../domain/device-inventory/repository/INetworkDeviceRepository';
import { UseCase } from '../../shared/core/UseCase';
import { ILogger } from '../../shared/interfaces/ILogger';
import {
  SoftDeleteNetworkDeviceRequestDTO,
  NetworkDeviceResponseDTO
} from '../../device-inventory/dtos';
import { NetworkDeviceMapper } from '../mappers/NetworkDeviceMapper';

/**
 * SoftDeleteNetworkDeviceUseCase
 *
 * REQ-002: Soft-deletes a network device with 7-day grace period.
 *
 * Workflow:
 * 1. Load device by ID
 * 2. Validate device is not already soft-deleted
 * 3. Extract deletion reason from DTO
 * 4. Call domain softDelete() method
 * 5. Persist changes
 * 6. Dispatch NetworkDeviceDeletedEvent (via repository)
 *
 * Business Rules:
 * - Device must exist
 * - Device must NOT already be soft-deleted
 * - Device can be in any activationStatus (DRAFT or ACTIVE)
 * - Sets deletedAt timestamp automatically
 * - Sets deletedBy from request context (TODO: auth context)
 * - Reason is optional but recommended for audit trail
 * - Device enters 7-day grace period for restoration
 * - After 7 days, permanent deletion occurs automatically (background job)
 * - IP and MAC become available for reuse immediately
 *
 * @example
 * ```typescript
 * const useCase = new SoftDeleteNetworkDeviceUseCase(repository, logger);
 * const result = await useCase.execute({
 *   id: 'device-uuid',
 *   requestDTO: {
 *     reason: 'Device replaced with newer model'
 *   }
 * });
 * ```
 */
export class SoftDeleteNetworkDeviceUseCase extends UseCase<
  { id: string; requestDTO: SoftDeleteNetworkDeviceRequestDTO },
  NetworkDeviceResponseDTO
> {
  constructor(
    private readonly deviceRepository: INetworkDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'SoftDeleteNetworkDeviceUseCase');
  }

  /**
   * Validates device ID format before execution.
   */
  protected async beforeExecute(request: {
    id: string;
    requestDTO: SoftDeleteNetworkDeviceRequestDTO;
  }): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return this.fail<void>('Device ID is required');
    }

    // Validate reason length if provided
    if (
      request.requestDTO.reason &&
      request.requestDTO.reason.length > 500
    ) {
      return this.fail<void>(
        'Deletion reason cannot exceed 500 characters'
      );
    }

    return null;
  }

  /**
   * Soft-deletes the device.
   *
   * Orchestrates:
   * 1. Load device
   * 2. Validate soft-delete preconditions
   * 3. Extract deletion reason
   * 4. Call domain softDelete() method
   * 5. Persist updated aggregate
   */
  protected async executeImpl(request: {
    id: string;
    requestDTO: SoftDeleteNetworkDeviceRequestDTO;
  }): Promise<Result<NetworkDeviceResponseDTO>> {
    // 1. Extract deletion data from DTO
    const data = NetworkDeviceMapper.extractSoftDeleteData(
      request.requestDTO
    );

    // 2. Create device ID value object
    const deviceIdResult = NetworkDeviceId.create(request.id);
    if (deviceIdResult.isFailure) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Invalid device ID: ${deviceIdResult.error}`
      );
    }

    // 3. Load device from repository
    const deviceResult = await this.deviceRepository.findById(
      deviceIdResult.value
    );
    if (deviceResult.isFailure) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Error loading device: ${deviceResult.error}`
      );
    }

    if (!deviceResult.value) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Device with ID ${request.id} not found`
      );
    }

    const device = deviceResult.value;

    // 4. Validate device is not already soft-deleted
    if (device.deletedAt !== null) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Device is already soft-deleted on ${device.deletedAt.toISOString()}. ` +
          `Use RestoreNetworkDeviceUseCase to restore it within the 7-day grace period.`
      );
    }

    // 5. Soft-delete the device (domain method)
    // TODO: Get deletedBy from authentication context
    const deletedBy = 'system:admin'; // Placeholder
    const softDeleteResult = device.softDelete(
      deletedBy,
      data.reason ?? undefined
    );
    if (softDeleteResult.isFailure) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Failed to soft-delete device: ${softDeleteResult.error}`
      );
    }

    // 6. Persist updated device
    const saveResult = await this.deviceRepository.save(device);
    if (saveResult.isFailure) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Failed to save soft-deleted device: ${saveResult.error}`
      );
    }

    // 7. Convert to response DTO
    const responseDTO = NetworkDeviceMapper.toDTO(device);

    return this.ok(responseDTO);
  }
}
