import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  IAlertThresholdsRepository,
  IWirelessDeviceConfigRepository
} from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  DeviceAlertThresholdsRequestDTO,
  DeviceAlertThresholdsResponseDTO
} from '../dtos';
import { AlertThresholdsMapper } from '../mappers';

export const WIRELESS_CONFIG_NOT_FOUND =
  'Wireless config not found for device';

export class GetDeviceAlertThresholdsUseCase extends UseCase<
  DeviceAlertThresholdsRequestDTO,
  DeviceAlertThresholdsResponseDTO
> {
  constructor(
    private readonly configRepo: IWirelessDeviceConfigRepository,
    private readonly thresholdsRepo: IAlertThresholdsRepository,
    logger: ILogger
  ) {
    super(logger, 'GetDeviceAlertThresholdsUseCase');
  }

  protected async executeImpl(
    request: DeviceAlertThresholdsRequestDTO
  ): Promise<Result<DeviceAlertThresholdsResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const configResult =
      await this.configRepo.findByDeviceId(deviceId);
    if (configResult.isFailure) return this.fail(configResult.error!);
    if (configResult.value === null) {
      return this.fail(WIRELESS_CONFIG_NOT_FOUND);
    }

    const global = await this.thresholdsRepo.getGlobal();
    if (global.isFailure) {
      return this.fail(
        `Failed to load alert thresholds: ${global.error}`
      );
    }
    const overrides =
      await this.thresholdsRepo.findOverrides(deviceId);
    if (overrides.isFailure) {
      return this.fail(
        `Failed to load alert threshold overrides: ${overrides.error}`
      );
    }

    return this.ok({
      deviceId: deviceId.toString(),
      overrides: AlertThresholdsMapper.overridesToDTO(
        overrides.value
      ),
      install: AlertThresholdsMapper.toDTO(global.value),
      effective: AlertThresholdsMapper.toDTO(
        global.value.withOverrides(overrides.value.values)
      )
    });
  }
}
