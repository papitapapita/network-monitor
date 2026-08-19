import { Result } from 'domain/shared/core';
import { DeviceId, WirelessAlertRecordId } from 'domain/shared/ids';
import { IWirelessAlertRecordRepository } from 'domain/wireless-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  ClearWirelessAlertRequestDTO,
  WirelessAlertResponseDTO
} from '../dtos';
import { WirelessAlertMapper } from '../mappers';

export class ClearWirelessAlertUseCase extends UseCase<
  ClearWirelessAlertRequestDTO,
  WirelessAlertResponseDTO
> {
  constructor(
    private readonly alertRecordRepo: IWirelessAlertRecordRepository,
    logger: ILogger
  ) {
    super(logger, 'ClearWirelessAlertUseCase');
  }

  protected async executeImpl(
    request: ClearWirelessAlertRequestDTO
  ): Promise<Result<WirelessAlertResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const alertIdResult = WirelessAlertRecordId.parse(
      request.alertId
    );
    if (alertIdResult.isFailure) {
      return this.fail(`Invalid alert ID: ${alertIdResult.error}`);
    }

    const recordResult = await this.alertRecordRepo.findById(
      alertIdResult.value
    );
    if (recordResult.isFailure) {
      return this.fail(recordResult.error);
    }

    const record = recordResult.value;
    if (
      record === null ||
      record.deviceId.toString() !== deviceIdResult.value.toString()
    ) {
      return this.fail('Wireless alert not found for device');
    }

    const clearResult = record.clear(new Date());
    if (clearResult.isFailure) {
      // Clearing is idempotent — an already-cleared alert is a success
      // no-op, not an error, matching the automatic-clear behaviour.
      if (clearResult.error === 'Alert is already cleared') {
        return this.ok(WirelessAlertMapper.toDTO(record));
      }
      return this.fail(clearResult.error);
    }

    const saveResult = await this.alertRecordRepo.save(record);
    if (saveResult.isFailure) {
      return this.fail(saveResult.error);
    }

    return this.ok(WirelessAlertMapper.toDTO(saveResult.value));
  }
}
