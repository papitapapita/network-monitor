import {
  Result,
  NetworkDevice,
  NetworkDeviceId
} from '../../../src/domain/device-inventory';
import { INetworkDeviceRepository } from '../../../domain/device-inventory/repository/INetworkDeviceRepository';
import { UseCase } from '../../../src/application/shared/core/UseCase';
import { ILogger } from '../../../src/application/shared/interfaces/ILogger';
import {
  RestoreNetworkDeviceRequestDTO,
  NetworkDeviceResponseDTO
} from '../../../src/application/device-inventory/dtos';
import { NetworkDeviceMapper } from '../mappers/NetworkDeviceMapper';

/**
 * RestoreNetworkDeviceUseCase
 *
 * REQ-002: Restores a soft-deleted network device within the 7-day grace period.
 *
 * Workflow:
 * 1. Load device including deleted ones
 * 2. Validate device is soft-deleted
 * 3. Validate device is within 7-day grace period
 * 4. Check for IP/MAC conflicts with active devices
 * 5. Call domain restore() method
 * 6. Persist changes
 * 7. Dispatch NetworkDeviceRestoredEvent (via repository)
 *
 * Business Rules:
 * - Device must exist
 * - Device MUST be soft-deleted (deletedAt not null)
 * - Device must be within 7-day grace period
 * - IP address must still be unique (no conflicts with active devices)
 * - MAC address must still be unique (no conflicts with active devices)
 * - Device returns to previous activationStatus (DRAFT or ACTIVE)
 * - Clears deletedAt and deletedBy fields
 * - If conflicts exist, restoration fails with specific error
 *
 * Conflict Resolution:
 * - If IP/MAC now in use by another device, restoration is blocked
 * - User must either:
 *   1. Delete/soft-delete the conflicting device first
 *   2. Let this device expire and create new one
 *
 * @example
 * ```typescript
 * const useCase = new RestoreNetworkDeviceUseCase(repository, logger);
 * const result = await useCase.execute({
 *   id: 'device-uuid',
 *   requestDTO: {}
 * });
 * ```
 */
export class RestoreNetworkDeviceUseCase extends UseCase<
  { id: string; requestDTO: RestoreNetworkDeviceRequestDTO },
  NetworkDeviceResponseDTO
> {
  constructor(
    private readonly deviceRepository: INetworkDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'RestoreNetworkDeviceUseCase');
  }

  /**
   * Validates device ID format before execution.
   */
  protected async beforeExecute(request: {
    id: string;
    requestDTO: RestoreNetworkDeviceRequestDTO;
  }): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return this.fail<void>('Device ID is required');
    }

    return null;
  }

  /**
   * Restores the soft-deleted device.
   *
   * Orchestrates:
   * 1. Load device including deleted ones
   * 2. Validate device is soft-deleted
   * 3. Validate 7-day grace period
   * 4. Check for IP/MAC conflicts
   * 5. Call domain restore() method
   * 6. Persist updated aggregate
   */
  protected async executeImpl(request: {
    id: string;
    requestDTO: RestoreNetworkDeviceRequestDTO;
  }): Promise<Result<NetworkDeviceResponseDTO>> {
    // 1. Create device ID value object
    const deviceIdResult = NetworkDeviceId.create(request.id);
    if (deviceIdResult.isFailure) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Invalid device ID: ${deviceIdResult.error}`
      );
    }

    // 2. Load device INCLUDING deleted ones
    const deviceResult =
      await this.deviceRepository.findByIdIncludingDeleted(
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

    // 3. Validate device IS soft-deleted
    if (device.deletedAt === null) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Device is not soft-deleted. Only soft-deleted devices can be restored.`
      );
    }

    // 4. Validate 7-day grace period
    const now = new Date();
    const daysSinceDeletion =
      (now.getTime() - device.deletedAt.getTime()) /
      (1000 * 60 * 60 * 24);

    if (daysSinceDeletion > 7) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Device was deleted ${daysSinceDeletion.toFixed(1)} days ago. ` +
          `The 7-day grace period has expired and the device cannot be restored.`
      );
    }

    // 5. Check for IP address conflicts
    const ipConflictResult =
      await this.deviceRepository.findByIpAddress(device.ipAddress);
    if (ipConflictResult.isFailure) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Error checking IP conflicts: ${ipConflictResult.error}`
      );
    }

    if (ipConflictResult.value) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Cannot restore device: IP address ${device.ipAddress.toString()} ` +
          `is now in use by device ${ipConflictResult.value.id.toString()}. ` +
          `Delete the conflicting device first or let this device expire.`
      );
    }

    // 6. Check for MAC address conflicts
    const macConflictResult =
      await this.deviceRepository.findByMacAddress(device.macAddress);
    if (macConflictResult.isFailure) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Error checking MAC conflicts: ${macConflictResult.error}`
      );
    }

    if (macConflictResult.value) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Cannot restore device: MAC address ${device.macAddress.toString()} ` +
          `is now in use by device ${macConflictResult.value.id.toString()}. ` +
          `Delete the conflicting device first or let this device expire.`
      );
    }

    // 7. Restore the device (domain method)
    const restoreResult = device.restore();
    if (restoreResult.isFailure) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Failed to restore device: ${restoreResult.error}`
      );
    }

    // 8. Persist updated device
    const saveResult = await this.deviceRepository.save(device);
    if (saveResult.isFailure) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Failed to save restored device: ${saveResult.error}`
      );
    }

    // 9. Convert to response DTO
    const responseDTO = NetworkDeviceMapper.toDTO(device);

    return this.ok(responseDTO);
  }
}
