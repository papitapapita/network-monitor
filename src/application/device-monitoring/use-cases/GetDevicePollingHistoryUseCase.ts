import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IPingResultRepository } from 'domain/device-monitoring/repository';
import { PollingMapper } from '../mappers';
import {
  GetDevicePollingHistoryDTO,
  PollingHistoryDTO
} from '../dtos';
import { DeviceId } from 'domain/shared';

export class GetDevicePollingHistoryUseCase extends UseCase<
  GetDevicePollingHistoryDTO,
  PollingHistoryDTO
> {
  private static readonly DEFAULT_LIMIT = 100;
  private static readonly DEFAULT_OFFSET = 0;
  private static readonly MAX_LIMIT = 1000;

  constructor(
    private readonly pingResultRepo: IPingResultRepository,
    logger: ILogger
  ) {
    super(logger, 'GetDevicePollingHistoryUseCase');
  }

  protected async beforeExecute(
    query: GetDevicePollingHistoryDTO
  ): Promise<Result<void> | null> {
    if (!query.deviceId?.trim()) {
      return Result.fail('Network device ID is required');
    }

    if (
      query.limit !== undefined &&
      (query.limit < 1 ||
        query.limit > GetDevicePollingHistoryUseCase.MAX_LIMIT)
    ) {
      return Result.fail(
        `Limit must be between 1 and ${GetDevicePollingHistoryUseCase.MAX_LIMIT}`
      );
    }

    if (query.offset !== undefined && query.offset < 0) {
      return Result.fail('Offset must be >= 0');
    }

    if (
      query.fromDate &&
      query.toDate &&
      query.fromDate > query.toDate
    ) {
      return Result.fail('fromDate must be before toDate');
    }

    return null;
  }

  protected async executeImpl(
    query: GetDevicePollingHistoryDTO
  ): Promise<Result<PollingHistoryDTO>> {
    const limit =
      query.limit ?? GetDevicePollingHistoryUseCase.DEFAULT_LIMIT;
    const offset =
      query.offset ?? GetDevicePollingHistoryUseCase.DEFAULT_OFFSET;

    const deviceIdResult = DeviceId.parse(query.deviceId);

    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }

    const isReachable = this.resolveIsReachableFilter(query.status);

    const pageResult = await this.pingResultRepo.findByDevice(
      deviceIdResult.value,
      {
        isReachable,
        fromDate: query.fromDate,
        toDate: query.toDate,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        limit,
        offset
      }
    );

    if (pageResult.isFailure) {
      return this.fail(
        `Failed to retrieve polling history: ${pageResult.error}`
      );
    }

    const { records, total } = pageResult.value;

    return this.ok(
      PollingMapper.toHistoryDTO(records, query.deviceId, total)
    );
  }

  private resolveIsReachableFilter(
    status: GetDevicePollingHistoryDTO['status']
  ): boolean | undefined {
    if (!status || status.length === 0) return undefined;
    const wantSuccess = status.includes('SUCCESS');
    const wantFailed = status.includes('FAILED');
    const wantUnknown = status.includes('UNKNOWN');

    if (wantUnknown) return undefined; // If 'UNKNOWN' is included, ignore other filters
    if (wantSuccess && !wantFailed) return true;
    if (wantFailed && !wantSuccess) return false;
    return undefined;
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return data;
  }
}
