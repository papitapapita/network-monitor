import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IPAddress } from 'domain/shared/value-objects';
import { IWirelessPollingConfigRepository } from 'domain/wireless-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { WirelessConfigResponseDTO } from '../dtos';
import { WirelessPollingConfigMapper } from '../mappers';

export interface UpdateWirelessConfigRequestDTO {
  deviceId: string;
  // undefined = skip, null = clear, string = set new value
  ipAddress?: string | null;
  intervalSecs?: number;
  enabled?: boolean;
  // null = clear, number = set, undefined = skip
  linkCapacityBps?: number | null;
  clientsProvisionedLimit?: number | null;
}

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
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const configResult =
      await this.configRepo.findByDeviceId(deviceId);
    if (configResult.isFailure) {
      return this.fail(configResult.error);
    }
    const config = configResult.value;
    if (config === null) {
      return this.fail('Wireless config not found for device');
    }

    const updates = WirelessPollingConfigMapper.extractUpdateData(request);

    if (updates.ipAddress !== undefined) {
      if (updates.ipAddress === null) {
        config.updateIpAddress(null);
      } else {
        const ipResult = IPAddress.create(updates.ipAddress);
        if (ipResult.isFailure) {
          return this.fail(`Invalid IP address: ${ipResult.error}`);
        }
        config.updateIpAddress(ipResult.value);
      }
    }

    // enable/disable use domain methods so the toggle event is raised
    if (updates.enabled === true) {
      config.enable();
    } else if (updates.enabled === false) {
      config.disable();
    }

    if (updates.intervalSecs !== undefined) {
      const result = config.updateIntervalSecs(updates.intervalSecs);
      if (result.isFailure) {
        return this.fail(result.error);
      }
    }
    if (updates.linkCapacityBps !== undefined) {
      config.updateLinkCapacityBps(updates.linkCapacityBps);
    }
    if (updates.clientsProvisionedLimit !== undefined) {
      config.updateClientsProvisionedLimit(
        updates.clientsProvisionedLimit
      );
    }

    const saveResult = await this.configRepo.save(config);
    if (saveResult.isFailure) {
      return this.fail(saveResult.error);
    }

    return this.ok(WirelessPollingConfigMapper.toDTO(saveResult.value));
  }
}
