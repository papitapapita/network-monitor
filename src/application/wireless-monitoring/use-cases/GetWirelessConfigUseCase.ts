import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { IWirelessPollingConfigRepository } from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { WirelessConfigResponseDTO } from '../dtos/WirelessConfigResponseDTO';
import { WirelessPollingConfigMapper } from '../mappers/WirelessPollingConfigMapper';

/**
 * Request DTO for retrieving a wireless polling configuration.
 *
 * Used By: GetWirelessConfigUseCase
 * API Endpoint: GET /api/wireless/configs/:deviceId
 */
export interface GetWirelessConfigRequestDTO {
  /** ID of the device whose polling config is being retrieved */
  deviceId: string;
}

/**
 * GetWirelessConfigUseCase
 *
 * Business Intent: Retrieve the wireless polling configuration for a specific device.
 *
 * Flow:
 * 1. beforeExecute — Validate that deviceId is present
 * 2. executeImpl   — Parse DeviceId, load config from repository, return DTO
 *
 * Business Rules:
 * - Returns a failure when no config is registered for the device
 *
 * Dependencies:
 * - IWirelessPollingConfigRepository: Query the polling config by device
 * - ILogger: Structured logging via the UseCase base class
 */
export class GetWirelessConfigUseCase extends UseCase<
  GetWirelessConfigRequestDTO,
  WirelessConfigResponseDTO
> {
  constructor(
    private readonly configRepo: IWirelessPollingConfigRepository,
    logger: ILogger
  ) {
    super(logger, 'GetWirelessConfigUseCase');
  }

  protected async beforeExecute(
    request: GetWirelessConfigRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetWirelessConfigRequestDTO
  ): Promise<Result<WirelessConfigResponseDTO>> {
    // 1. Parse DeviceId
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    // 2. Load the config
    const configResult =
      await this.configRepo.findByDeviceId(deviceId);
    if (configResult.isFailure) {
      return this.fail(configResult.error);
    }
    const config = configResult.value;
    if (config === null) {
      return this.fail('Wireless config not found for device');
    }

    // 3. Return response DTO
    return this.ok(WirelessPollingConfigMapper.toDTO(config));
  }
}
