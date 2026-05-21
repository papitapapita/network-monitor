import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { IPAddress } from 'domain/shared';
import { IWirelessPollingConfigRepository } from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { WirelessConfigResponseDTO } from '../dtos/WirelessConfigResponseDTO';
import { WirelessPollingConfigMapper } from '../mappers/WirelessPollingConfigMapper';

/**
 * Request DTO for updating a wireless polling configuration.
 *
 * Used By: UpdateWirelessConfigUseCase
 * API Endpoint: PATCH /api/wireless/configs/:deviceId
 *
 * All fields are optional — only explicitly provided fields are applied (PATCH semantics).
 * For ipAddress: undefined = skip, null = clear, string = set new value.
 */
export interface UpdateWirelessConfigRequestDTO {
  /** ID of the device whose polling config will be updated — required */
  deviceId: string;

  /**
   * New IP address for polling.
   * Omit to leave unchanged.
   * Pass null to clear the current IP address.
   * Pass a string to set a new IP address.
   */
  ipAddress?: string | null;

  /** New polling interval in seconds — omit to leave unchanged */
  intervalSecs?: number;

  /** Toggle polling on or off — omit to leave unchanged */
  enabled?: boolean;

  /** New link capacity in bits per second — null to clear — omit to leave unchanged */
  linkCapacityBps?: number | null;

  /** New clients provisioned limit — null to clear — omit to leave unchanged */
  clientsProvisionedLimit?: number | null;
}

/**
 * UpdateWirelessConfigUseCase
 *
 * Business Intent: Apply a partial update to an existing wireless polling configuration.
 *
 * Flow:
 * 1. beforeExecute — Validate that deviceId is present
 * 2. executeImpl   — Parse DeviceId, load config, apply only the provided mutations,
 *                    persist and return the updated DTO
 *
 * Business Rules:
 * - Strict PATCH semantics: undefined fields are never applied
 * - ipAddress = null clears the IP; ipAddress = string sets it; omitted = no change
 * - enabled = true calls config.enable(); enabled = false calls config.disable()
 * - intervalSecs, linkCapacityBps, clientsProvisionedLimit are set directly on props
 *   when provided (no domain setter methods exist for these scalars)
 *
 * Dependencies:
 * - IWirelessPollingConfigRepository: Load and persist the polling config
 * - ILogger: Structured logging via the UseCase base class
 */
export class UpdateWirelessConfigUseCase extends UseCase<
  UpdateWirelessConfigRequestDTO,
  WirelessConfigResponseDTO
> {
  constructor(
    private readonly configRepo: IWirelessPollingConfigRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateWirelessConfigUseCase');
  }

  protected async beforeExecute(
    request: UpdateWirelessConfigRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: UpdateWirelessConfigRequestDTO
  ): Promise<Result<WirelessConfigResponseDTO>> {
    // 1. Parse DeviceId
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    // 2. Load the existing config
    const configResult =
      await this.configRepo.findByDeviceId(deviceId);
    if (configResult.isFailure) {
      return this.fail(configResult.error);
    }
    const config = configResult.value;
    if (config === null) {
      return this.fail('Wireless config not found for device');
    }

    // 3. Apply mutations — only for fields that are explicitly provided

    // ipAddress: undefined = skip, null = clear, string = update
    if (request.ipAddress !== undefined) {
      if (request.ipAddress === null) {
        config.updateIpAddress(null);
      } else {
        const ipResult = IPAddress.create(request.ipAddress);
        if (ipResult.isFailure) {
          return this.fail(`Invalid IP address: ${ipResult.error}`);
        }
        config.updateIpAddress(ipResult.value);
      }
    }

    // enabled: delegate to domain methods to ensure the toggle event is raised
    if (request.enabled === true) {
      config.enable();
    } else if (request.enabled === false) {
      config.disable();
    }

    // Scalar field mutations — delegated to domain methods
    if (request.intervalSecs !== undefined) {
      const result = config.updateIntervalSecs(request.intervalSecs);
      if (result.isFailure) {
        return this.fail(result.error);
      }
    }
    if (request.linkCapacityBps !== undefined) {
      config.updateLinkCapacityBps(request.linkCapacityBps);
    }
    if (request.clientsProvisionedLimit !== undefined) {
      config.updateClientsProvisionedLimit(
        request.clientsProvisionedLimit
      );
    }

    // 4. Persist
    const saveResult = await this.configRepo.save(config);
    if (saveResult.isFailure) {
      return this.fail(saveResult.error);
    }

    // 5. Return response DTO
    return this.ok(
      WirelessPollingConfigMapper.toDTO(saveResult.value)
    );
  }
}
