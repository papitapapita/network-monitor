import { Result } from 'domain/shared/core';
import { DeviceId, WirelessAlertRecordId } from 'domain/shared/ids';
import { WirelessAlertRecord } from 'domain/wireless-monitoring/aggregates';
import { IWirelessAlertRecordRepository } from 'domain/wireless-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  BulkClearWirelessAlertsRequestDTO,
  BulkClearWirelessAlertsResponseDTO
} from '../dtos';
import { WirelessAlertMapper } from '../mappers';

export class BulkClearWirelessAlertsUseCase extends UseCase<
  BulkClearWirelessAlertsRequestDTO,
  BulkClearWirelessAlertsResponseDTO
> {
  constructor(
    private readonly alertRecordRepo: IWirelessAlertRecordRepository,
    logger: ILogger
  ) {
    super(logger, 'BulkClearWirelessAlertsUseCase');
  }

  protected async executeImpl(
    request: BulkClearWirelessAlertsRequestDTO
  ): Promise<Result<BulkClearWirelessAlertsResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const skipped: { id: string; reason: string }[] = [];
    const failed: { id: string; error: string }[] = [];

    const targets = await this.resolveTargets(
      deviceId,
      request.ids,
      failed
    );
    if (targets === null) {
      return this.fail(failed[0]?.error ?? 'Failed to load alerts');
    }

    const cleared: BulkClearWirelessAlertsResponseDTO['cleared'] = [];
    for (const record of targets) {
      const clearResult = record.clear(new Date());
      if (clearResult.isFailure) {
        skipped.push({
          id: record.id.toString(),
          reason: clearResult.error
        });
        continue;
      }

      const saveResult = await this.alertRecordRepo.save(record);
      if (saveResult.isFailure) {
        failed.push({
          id: record.id.toString(),
          error: saveResult.error
        });
        continue;
      }

      cleared.push(WirelessAlertMapper.toDTO(saveResult.value));
    }

    return this.ok({ cleared, skipped, failed });
  }

  private async resolveTargets(
    deviceId: DeviceId,
    ids: string[] | undefined,
    failed: { id: string; error: string }[]
  ): Promise<WirelessAlertRecord[] | null> {
    if (!ids || ids.length === 0) {
      const activeResult =
        await this.alertRecordRepo.findAllActiveByDevice(deviceId);
      if (activeResult.isFailure) {
        failed.push({ id: '', error: activeResult.error });
        return null;
      }
      return activeResult.value;
    }

    const targets: WirelessAlertRecord[] = [];
    for (const rawId of ids) {
      const idResult = WirelessAlertRecordId.parse(rawId);
      if (idResult.isFailure) {
        failed.push({
          id: rawId,
          error: `Invalid alert ID: ${idResult.error}`
        });
        continue;
      }

      const recordResult = await this.alertRecordRepo.findById(
        idResult.value
      );
      if (recordResult.isFailure) {
        failed.push({ id: rawId, error: recordResult.error });
        continue;
      }

      const record = recordResult.value;
      if (record === null) {
        failed.push({ id: rawId, error: 'Wireless alert not found' });
        continue;
      }
      if (record.deviceId.toString() !== deviceId.toString()) {
        failed.push({
          id: rawId,
          error: 'Alert does not belong to this device'
        });
        continue;
      }

      targets.push(record);
    }
    return targets;
  }
}
