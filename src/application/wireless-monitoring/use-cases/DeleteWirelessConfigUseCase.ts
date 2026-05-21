import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { IWirelessPollingConfigRepository } from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';

/**
 * Request DTO for deleting a wireless polling configuration.
 *
 * Used By: DeleteWirelessConfigUseCase
 * API Endpoint: DELETE /api/wireless/configs/:deviceId
 */
export interface DeleteWirelessConfigRequestDTO {
  /** ID of the device whose polling config should be deleted */
  deviceId: string;
}

/**
 * DeleteWirelessConfigUseCase
 *
 * Business Intent: Remove the wireless polling configuration registered for a device.
 *
 * Flow:
 * 1. beforeExecute — Validate that deviceId is present
 * 2. executeImpl   — Parse DeviceId, verify the config exists, then delete it
 *
 * Business Rules:
 * - Returns a failure when no config is registered for the device
 * - Returns no body on success (void result)
 *
 * Dependencies:
 * - IWirelessPollingConfigRepository: Load and delete the polling config
 * - ILogger: Structured logging via the UseCase base class
 */
export class DeleteWirelessConfigUseCase extends UseCase<
  DeleteWirelessConfigRequestDTO,
  void
> {
  constructor(
    private readonly configRepo: IWirelessPollingConfigRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteWirelessConfigUseCase');
  }

  protected async beforeExecute(
    request: DeleteWirelessConfigRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: DeleteWirelessConfigRequestDTO
  ): Promise<Result<void>> {
    // 1. Parse DeviceId
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    // 2. Verify the config exists before attempting deletion
    const configResult =
      await this.configRepo.findByDeviceId(deviceId);
    if (configResult.isFailure) {
      return this.fail(configResult.error);
    }
    if (configResult.value === null) {
      return this.fail('Wireless config not found for device');
    }

    // 3. Delete — repository returns Result<void>
    const deleteResult = await this.configRepo.delete(deviceId);
    if (deleteResult.isFailure) {
      return this.fail(deleteResult.error);
    }

    return this.ok(undefined as unknown as void);
  }
}
