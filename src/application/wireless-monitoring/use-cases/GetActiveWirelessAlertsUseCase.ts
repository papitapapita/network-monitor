import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { IWirelessAlertRecordRepository } from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { GetActiveAlertsRequestDTO } from '../dtos/GetActiveAlertsRequestDTO';
import { WirelessAlertResponseDTO } from '../dtos/WirelessAlertResponseDTO';
import { WirelessAlertMapper } from '../mappers/WirelessAlertMapper';

export class GetActiveWirelessAlertsUseCase extends UseCase<
  GetActiveAlertsRequestDTO,
  WirelessAlertResponseDTO[]
> {
  constructor(
    private readonly alertRecordRepo: IWirelessAlertRecordRepository,
    logger: ILogger
  ) {
    super(logger, 'GetActiveWirelessAlertsUseCase');
  }

  protected async executeImpl(
    request: GetActiveAlertsRequestDTO
  ): Promise<Result<WirelessAlertResponseDTO[]>> {
    if (request.deviceId) {
      const deviceIdResult = DeviceId.parse(request.deviceId);
      if (deviceIdResult.isFailure) {
        return this.fail(
          `Invalid device ID: ${deviceIdResult.error}`
        );
      }
      const deviceId = deviceIdResult.value;

      const alertsResult =
        await this.alertRecordRepo.findAllActiveByDevice(deviceId);
      if (alertsResult.isFailure) {
        return this.fail(
          `Failed to load active alerts: ${alertsResult.error}`
        );
      }
      return this.ok(
        alertsResult.value.map(WirelessAlertMapper.toDTO)
      );
    }

    const alertsResult = await this.alertRecordRepo.findAllActive();
    if (alertsResult.isFailure) {
      return this.fail(
        `Failed to load active alerts: ${alertsResult.error}`
      );
    }
    return this.ok(alertsResult.value.map(WirelessAlertMapper.toDTO));
  }
}
