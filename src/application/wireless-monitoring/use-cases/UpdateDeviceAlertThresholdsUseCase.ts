import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  AlertThresholdOverrides,
  IAlertThresholdsRepository,
  IWirelessDeviceConfigRepository
} from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  DeviceAlertThresholdsResponseDTO,
  UpdateDeviceAlertThresholdsRequestDTO
} from '../dtos';
import { AlertThresholdsMapper } from '../mappers';
import { WIRELESS_CONFIG_NOT_FOUND } from './GetDeviceAlertThresholdsUseCase';

// Replaces the device's overrides as a whole; an empty set returns the
// device to the install's thresholds (WLS-201).
export class UpdateDeviceAlertThresholdsUseCase extends UseCase<
  UpdateDeviceAlertThresholdsRequestDTO,
  DeviceAlertThresholdsResponseDTO
> {
  constructor(
    private readonly configRepo: IWirelessDeviceConfigRepository,
    private readonly thresholdsRepo: IAlertThresholdsRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateDeviceAlertThresholdsUseCase');
  }

  protected async executeImpl(
    request: UpdateDeviceAlertThresholdsRequestDTO
  ): Promise<Result<DeviceAlertThresholdsResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const overrides = AlertThresholdOverrides.create(
      AlertThresholdsMapper.toOverridesProps(request.overrides)
    );
    if (overrides.isFailure) return this.fail(overrides.error!);

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

    const saved = await this.thresholdsRepo.saveOverrides(
      deviceId,
      overrides.value
    );
    if (saved.isFailure) {
      return this.fail(
        `Failed to save alert threshold overrides: ${saved.error}`
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
