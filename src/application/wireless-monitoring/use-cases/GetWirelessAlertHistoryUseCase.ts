import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IWirelessAlertRecordRepository } from 'domain/wireless-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  GetAlertHistoryRequestDTO,
  WirelessAlertResponseDTO
} from '../dtos';
import { WirelessAlertMapper } from '../mappers';

export class GetWirelessAlertHistoryUseCase extends UseCase<
  GetAlertHistoryRequestDTO,
  WirelessAlertResponseDTO[]
> {
  constructor(
    private readonly alertRecordRepo: IWirelessAlertRecordRepository,
    logger: ILogger
  ) {
    super(logger, 'GetWirelessAlertHistoryUseCase');
  }

  protected async beforeExecute(
    request: GetAlertHistoryRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetAlertHistoryRequestDTO
  ): Promise<Result<WirelessAlertResponseDTO[]>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const from = request.from ?? new Date(0);
    const to = request.to ?? new Date();

    const alertsResult =
      await this.alertRecordRepo.findHistoryByDevice(
        deviceId,
        from,
        to,
        request.limit
      );
    if (alertsResult.isFailure) {
      return this.fail(
        `Failed to load alert history: ${alertsResult.error}`
      );
    }

    return this.ok(alertsResult.value.map(WirelessAlertMapper.toDTO));
  }
}
