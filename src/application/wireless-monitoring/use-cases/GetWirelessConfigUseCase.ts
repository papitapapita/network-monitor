import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IWirelessPollingConfigRepository } from 'domain/wireless-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { WirelessConfigResponseDTO } from '../dtos';
import { WirelessPollingConfigMapper } from '../mappers';

export interface GetWirelessConfigRequestDTO {
  deviceId: string;
}

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

    return this.ok(WirelessPollingConfigMapper.toDTO(config));
  }
}
