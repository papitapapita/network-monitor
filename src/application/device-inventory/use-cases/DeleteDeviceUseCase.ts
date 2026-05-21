import { DeviceId } from 'domain/shared/ids';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeleteDeviceRequestDTO } from '../dtos/DeleteDeviceRequestDTO';

/**
 * DeleteDeviceUseCase
 *
 * Business Intent: Permanently remove a device from the system by its unique identifier.
 *
 * Flow:
 * 1. beforeExecute: Validate that id is non-empty.
 * 2. executeImpl: Parse DeviceId, confirm the device exists,
 *    call the repository delete, and return a void success Result.
 *
 * Business Rules:
 * - id is required and must be a valid UUID.
 * - Returns a failure Result (not an exception) when the device is not found,
 *   so the presentation layer can map it to HTTP 404.
 * - The delete operation is delegated entirely to the repository; the use case
 *   performs no domain logic.
 *
 * Dependencies:
 * - IDeviceRepository: Write access to the Device aggregate store.
 * - ILogger: Structured logging via the base UseCase template.
 */
export class DeleteDeviceUseCase extends UseCase<
  DeleteDeviceRequestDTO,
  void
> {
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteDeviceUseCase');
  }

  // ============================================================================
  // Pre-execution validation
  // ============================================================================

  protected async beforeExecute(
    request: DeleteDeviceRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Device ID is required');
    }

    return null; // Validation passed
  }

  // ============================================================================
  // Main execution
  // ============================================================================

  protected async executeImpl(
    request: DeleteDeviceRequestDTO
  ): Promise<Result<void>> {
    const deviceIdResult = DeviceId.parse(request.id.trim());
    if (deviceIdResult.isFailure) {
      return this.fail<void>(
        `Invalid device ID: ${deviceIdResult.error}`
      );
    }

    const deviceId = deviceIdResult.value;

    const findResult = await this.deviceRepository.findById(deviceId);
    if (findResult.isFailure) {
      return this.fail<void>(findResult.error!);
    }

    if (findResult.value === null) {
      return this.fail<void>(`Device not found: ${request.id}`);
    }

    const deleteResult = await this.deviceRepository.delete(deviceId);
    if (deleteResult.isFailure) {
      return this.fail<void>(deleteResult.error!);
    }

    return this.ok(undefined);
  }
}
