import {
  Result,
  NetworkDeviceId,
  INetworkDeviceRepository
} from '../../../domain/device-inventory';
import { UseCase, ILogger, DeleteNetworkDeviceDTO } from '../..';

/**
 * DeleteNetworkDeviceUseCase
 *
 * Business Intent: Permanently delete a network device from the system
 *
 * Flow:
 * 1. beforeExecute: Validate device ID format
 * 2. executeImpl: Orchestrate permanent deletion
 * 3. afterExecute: Log operation (automatic via base class)
 *
 * Business Rules:
 * - Device must exist in the system
 * - Deletion is PERMANENT and IRREVERSIBLE
 * - All related data is CASCADE deleted:
 *   * PollingConfiguration is deleted
 *   * All PollingResult records (historical data) are deleted
 * - Device deletion event is dispatched before physical deletion
 * - IP and MAC addresses become immediately available for reuse
 * - Operation is logged for audit trail
 *
 * Requirements:
 * - REQ-002: Permanent deletion after grace period
 * - REQ-002: CASCADE deletion of related entities
 * - Audit trail requirement (logged as warning)
 *
 * Dependencies:
 * - INetworkDeviceRepository: Load and delete device
 * - ILogger: Log deletion for audit trail
 *
 * When to Use:
 * - After 7-day soft delete grace period expires (automated)
 * - Administrative cleanup of old/test devices
 * - Forced removal when soft delete is not appropriate
 *
 * Warning:
 * - This operation CANNOT BE UNDONE
 * - All historical polling data will be PERMANENTLY LOST
 * - Use SoftDeleteNetworkDeviceUseCase instead for recoverable deletion
 *
 * @example
 * ```typescript
 * const useCase = new DeleteNetworkDeviceUseCase(repository, logger);
 * const result = await useCase.execute({
 *   id: '550e8400-e29b-41d4-a716-446655440000'
 * });
 * ```
 */
export class DeleteNetworkDeviceUseCase extends UseCase<
  DeleteNetworkDeviceDTO,
  void
> {
  constructor(
    private readonly deviceRepository: INetworkDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteNetworkDeviceUseCase');
  }

  /**
   * Pre-execution validation.
   * Validates device ID format before deletion.
   */
  protected async beforeExecute(
    request: DeleteNetworkDeviceDTO
  ): Promise<Result<void> | null> {
    // Validate device ID is provided
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Device ID is required');
    }

    return null; // Validation passed
  }

  /**
   * Main execution: Orchestrate permanent device deletion.
   *
   * Steps:
   * 1. Validate device ID format
   * 2. Load device from repository
   * 3. Mark device for deletion (emits domain event)
   * 4. Save to dispatch deletion event BEFORE physical deletion
   * 5. Perform permanent deletion (CASCADE)
   */
  protected async executeImpl(
    request: DeleteNetworkDeviceDTO
  ): Promise<Result<void>> {
    const deviceIdResult = NetworkDeviceId.create(request.id);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }

    const deviceId = deviceIdResult.value;

    // Need to fetch device to:
    // - Verify it exists
    // - Emit deletion event with full context
    const deviceResult =
      await this.deviceRepository.findById(deviceId);
    if (deviceResult.isFailure) {
      return this.fail(`Error loading device: ${deviceResult.error}`);
    }

    if (!deviceResult.value) {
      return this.fail(
        `Network device with ID ${request.id} not found`
      );
    }

    const device = deviceResult.value;

    const markResult = device.markForDeletion();
    if (markResult.isFailure) {
      return this.fail(markResult.error!);
    }

    // This ensures event handlers can access device data before it's gone
    const saveResult = await this.deviceRepository.save(device);
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to save device before deletion: ${saveResult.error}`
      );
    }

    // Log deletion for audit trail (IMPORTANT for compliance)
    this.logger.warn(
      `Permanently deleting network device ${request.id}`,
      {
        deviceName: device.name,
        ipAddress: device.ipAddress.toString(),
        macAddress: device.macAddress.toString(),
        warning:
          'This will permanently delete the device and all associated polling data'
      }
    );

    // Database CASCADE will automatically delete:
    // - PollingConfiguration
    // - All PollingResult records (historical data)
    const deleteResult = await this.deviceRepository.delete(deviceId);
    if (deleteResult.isFailure) {
      return this.fail(
        `Failed to delete device: ${deleteResult.error}`
      );
    }

    return this.ok(undefined);
  }

  /**
   * Sanitize data for logging.
   * Include device details for audit trail.
   */
  protected sanitizeForLogging(data: any): any {
    if (!data) return data;

    // For delete operations, we want to log the ID for audit trail
    return {
      id: data.id
    };
  }
}
