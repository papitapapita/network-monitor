import { DeviceId } from 'domain/shared/ids';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { GetDeviceRequestDTO, DeviceResponseDTO } from '../dtos';
import { DeviceMapper } from '../mappers';

/**
 * GetDeviceUseCase
 *
 * Business Intent: Retrieve a single device by its unique identifier.
 *
 * Flow:
 * 1. beforeExecute: Validate that id is non-empty.
 * 2. executeImpl: Parse DeviceId, query the repository,
 *    and return a DeviceResponseDTO or a not-found failure.
 *
 * Business Rules:
 * - id is required and must be a valid UUID.
 * - Returns a failure Result (not an exception) when the device is not found,
 *   so the presentation layer can map it to HTTP 404.
 *
 * Dependencies:
 * - IDeviceRepository: Read-only access to the Device aggregate store.
 * - ILogger: Structured logging via the base UseCase template.
 */
export class GetDeviceUseCase extends UseCase<
  GetDeviceRequestDTO,
  DeviceResponseDTO
> {
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'GetDeviceUseCase');
  }

  // ============================================================================
  // Pre-execution validation
  // ============================================================================

  protected async beforeExecute(
    request: GetDeviceRequestDTO
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
    request: GetDeviceRequestDTO
  ): Promise<Result<DeviceResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.id.trim());
    if (deviceIdResult.isFailure) {
      return this.fail<DeviceResponseDTO>(
        `Invalid device ID: ${deviceIdResult.error}`
      );
    }

    const findResult = await this.deviceRepository.findById(
      deviceIdResult.value
    );

    if (findResult.isFailure) {
      return this.fail<DeviceResponseDTO>(findResult.error!);
    }

    const device = findResult.value;

    if (device === null) {
      return this.fail<DeviceResponseDTO>(
        `Device not found: ${request.id}`
      );
    }

    return this.ok(DeviceMapper.toDTO(device));
  }
}
