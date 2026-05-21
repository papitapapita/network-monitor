import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { IPAddress } from 'domain/shared';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import {
  IWirelessPollingConfigRepository,
  WirelessPollingConfig
} from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { WirelessConfigResponseDTO } from '../dtos/WirelessConfigResponseDTO';
import { WirelessPollingConfigMapper } from '../mappers/WirelessPollingConfigMapper';

/**
 * Request DTO for creating a wireless polling configuration.
 *
 * Used By: CreateWirelessConfigUseCase
 * API Endpoint: POST /api/wireless/configs
 */
export interface CreateWirelessConfigRequestDTO {
  /** ID of the device to attach this config to — required */
  deviceId: string;

  /** Device type determining the polling strategy — required */
  deviceType: 'STATION' | 'ACCESS_POINT';

  /** IP address to use for polling — null or omitted means not yet configured */
  ipAddress?: string | null;

  /** Polling interval in seconds — defaults to 3600 */
  intervalSecs?: number;

  /** Whether polling should start enabled — defaults to true */
  enabled?: boolean;

  /** Link capacity in bits per second — null if unknown */
  linkCapacityBps?: number | null;

  /** Maximum number of provisioned clients — null if not tracked */
  clientsProvisionedLimit?: number | null;
}

/**
 * CreateWirelessConfigUseCase
 *
 * Business Intent: Register a wireless polling configuration for an existing device.
 *
 * Flow:
 * 1. beforeExecute — Validate required fields (deviceId, deviceType)
 * 2. executeImpl   — Parse IDs, verify device existence, check no duplicate config,
 *                    build the WirelessPollingConfig entity, persist and return DTO
 *
 * Business Rules:
 * - The referenced device must already exist
 * - Each device may have at most one polling configuration
 * - intervalSecs defaults to 3600 when not provided
 * - enabled defaults to true when not provided
 *
 * Dependencies:
 * - IDeviceRepository: Check that the device exists
 * - IWirelessPollingConfigRepository: Persist and query polling configs
 * - ILogger: Structured logging via the UseCase base class
 */
export class CreateWirelessConfigUseCase extends UseCase<
  CreateWirelessConfigRequestDTO,
  WirelessConfigResponseDTO
> {
  constructor(
    private readonly deviceRepo: IDeviceRepository,
    private readonly configRepo: IWirelessPollingConfigRepository,
    logger: ILogger
  ) {
    super(logger, 'CreateWirelessConfigUseCase');
  }

  protected async beforeExecute(
    request: CreateWirelessConfigRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    if (!request.deviceType?.trim()) {
      return Result.fail('Device type is required');
    }
    return null;
  }

  protected async executeImpl(
    request: CreateWirelessConfigRequestDTO
  ): Promise<Result<WirelessConfigResponseDTO>> {
    // 1. Parse DeviceId
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    // 2. Load device and verify it exists and is wireless-capable
    const deviceResult = await this.deviceRepo.findById(deviceId);
    if (deviceResult.isFailure) {
      return this.fail(deviceResult.error);
    }
    if (deviceResult.value === null) {
      return this.fail('Device not found');
    }
    if (!deviceResult.value.canHaveWirelessConfig()) {
      return this.fail(
        'Device is not wireless-capable. Only WIRELESS_CPE and AP devices support wireless polling.'
      );
    }

    // 3. Ensure no duplicate config exists for this device
    const existingResult =
      await this.configRepo.findByDeviceId(deviceId);
    if (existingResult.isFailure) {
      return this.fail(existingResult.error);
    }
    if (existingResult.value !== null) {
      return this.fail(
        'Wireless config already exists for this device'
      );
    }

    // 4. Parse IP address when provided and non-null
    let ipAddress = null;
    if (request.ipAddress != null) {
      const ipResult = IPAddress.create(request.ipAddress);
      if (ipResult.isFailure) {
        return this.fail(`Invalid IP address: ${ipResult.error}`);
      }
      ipAddress = ipResult.value;
    }

    // 5. Build and validate the domain entity
    const configResult = WirelessPollingConfig.create({
      deviceId,
      ipAddress,
      enabled: request.enabled ?? true,
      intervalSecs: request.intervalSecs ?? 3600,
      deviceType: request.deviceType,
      linkCapacityBps: request.linkCapacityBps ?? null,
      clientsProvisionedLimit:
        request.clientsProvisionedLimit ?? null,
      lastPolledAt: null
    });
    if (configResult.isFailure) {
      return this.fail(configResult.error);
    }
    const config = configResult.value;

    // 6. Persist
    const saveResult = await this.configRepo.save(config);
    if (saveResult.isFailure) {
      return this.fail(saveResult.error);
    }

    // 7. Return response DTO
    return this.ok(
      WirelessPollingConfigMapper.toDTO(saveResult.value)
    );
  }
}
