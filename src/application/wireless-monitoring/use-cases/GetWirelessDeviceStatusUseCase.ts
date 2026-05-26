import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  IWirelessSnapshotRepository,
  IWirelessAlertRecordRepository
} from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  GetWirelessStatusRequestDTO,
  WirelessStatusResponseDTO
} from '../dtos';
import { WirelessSnapshotMapper } from '../mappers';

export class GetWirelessDeviceStatusUseCase extends UseCase<
  GetWirelessStatusRequestDTO,
  WirelessStatusResponseDTO
> {
  constructor(
    private readonly snapshotRepo: IWirelessSnapshotRepository,
    private readonly alertRecordRepo: IWirelessAlertRecordRepository,
    logger: ILogger
  ) {
    super(logger, 'GetWirelessDeviceStatusUseCase');
  }

  protected async beforeExecute(
    request: GetWirelessStatusRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetWirelessStatusRequestDTO
  ): Promise<Result<WirelessStatusResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const snapshotResult =
      await this.snapshotRepo.findLatestByDevice(deviceId);
    if (snapshotResult.isFailure) {
      return this.fail(
        `Failed to load wireless snapshot: ${snapshotResult.error}`
      );
    }
    const snapshot = snapshotResult.value;
    if (!snapshot) {
      return this.fail('No wireless data found for device');
    }

    const activeAlertsResult =
      await this.alertRecordRepo.findAllActiveByDevice(deviceId);
    const activeAlerts = activeAlertsResult.isSuccess
      ? activeAlertsResult.value
      : [];

    return this.ok(
      WirelessSnapshotMapper.toStatusDTO(snapshot, activeAlerts)
    );
  }
}
