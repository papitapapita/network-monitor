import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IPingResultRepository } from 'domain/device-monitoring/repository';
import {
  DeleteDevicePingHistoryDTO,
  DeleteDevicePingHistoryResponseDTO
} from '../dtos';

export class DeleteDevicePingHistoryUseCase extends UseCase<
  DeleteDevicePingHistoryDTO,
  DeleteDevicePingHistoryResponseDTO
> {
  constructor(
    private readonly pingResultRepo: IPingResultRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteDevicePingHistoryUseCase');
  }

  protected async beforeExecute(
    request: DeleteDevicePingHistoryDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Network device ID is required');
    }
    if (
      request.fromDate &&
      request.toDate &&
      request.fromDate > request.toDate
    ) {
      return Result.fail('fromDate must be before toDate');
    }
    return null;
  }

  protected async executeImpl(
    request: DeleteDevicePingHistoryDTO
  ): Promise<Result<DeleteDevicePingHistoryResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }

    const deleteResult = await this.pingResultRepo.deleteByDevice(
      deviceIdResult.value,
      { fromDate: request.fromDate, toDate: request.toDate }
    );
    if (deleteResult.isFailure) {
      return this.fail(
        `Failed to delete ping history: ${deleteResult.error}`
      );
    }

    return this.ok({ deletedCount: deleteResult.value });
  }
}
