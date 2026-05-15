import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { IWirelessSnapshotRepository } from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { GetWirelessHistoryRequestDTO } from '../dtos/GetWirelessHistoryRequestDTO';
import { WirelessHistoryResponseDTO } from '../dtos/WirelessHistoryResponseDTO';
import { WirelessSnapshotMapper } from '../mappers/WirelessSnapshotMapper';

export class GetWirelessDeviceHistoryUseCase extends UseCase<
  GetWirelessHistoryRequestDTO,
  WirelessHistoryResponseDTO
> {
  constructor(
    private readonly snapshotRepo: IWirelessSnapshotRepository,
    logger: ILogger
  ) {
    super(logger, 'GetWirelessDeviceHistoryUseCase');
  }

  protected async beforeExecute(
    request: GetWirelessHistoryRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    if (request.from >= request.to) {
      return Result.fail('from must be before to');
    }
    return null;
  }

  protected async executeImpl(
    request: GetWirelessHistoryRequestDTO
  ): Promise<Result<WirelessHistoryResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const snapshotsResult =
      await this.snapshotRepo.findHistoryByDevice(
        deviceId,
        request.from,
        request.to
      );
    if (snapshotsResult.isFailure) {
      return this.fail(
        `Failed to load wireless history: ${snapshotsResult.error}`
      );
    }
    const snapshots = snapshotsResult.value;

    return this.ok({
      snapshots: snapshots.map((s) =>
        WirelessSnapshotMapper.toStatusDTO(s, [])
      ),
      total: snapshots.length
    });
  }
}
