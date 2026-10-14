import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import {
  IAgentStatusQuery,
  ILogger
} from 'application/shared/interfaces';
import { IPollingStatusListQuery } from '../interfaces';
import { PollingMapper } from '../mappers';
import { DevicePollingStatusDTO } from '../dtos';

export class ListDevicePollingStatusesUseCase extends UseCase<
  void,
  DevicePollingStatusDTO[]
> {
  constructor(
    private readonly pollingStatusListQuery: IPollingStatusListQuery,
    logger: ILogger,
    private readonly agentStatusQuery: IAgentStatusQuery
  ) {
    super(logger, 'ListDevicePollingStatusesUseCase');
  }

  protected async executeImpl(): Promise<
    Result<DevicePollingStatusDTO[]>
  > {
    const rowsResult = await this.pollingStatusListQuery.listAll();
    if (rowsResult.isFailure) {
      return this.fail(
        `Failed to load polling statuses: ${rowsResult.error}`
      );
    }
    const rows = rowsResult.value;

    const unmeasured = await this.findUnmeasured(
      rows.map((row) => row.config.deviceId.toString())
    );

    return this.ok(
      rows.map((row) =>
        PollingMapper.toStatusDTO(
          row.config,
          row.state,
          row.lastPing,
          unmeasured.has(row.config.deviceId.toString())
        )
      )
    );
  }

  // R7. A failed read falls back to the stored state, as for a single device.
  private async findUnmeasured(
    deviceIds: string[]
  ): Promise<Set<string>> {
    if (deviceIds.length === 0) return new Set();
    const result =
      await this.agentStatusQuery.findUnmeasuredDevices(deviceIds);
    if (result.isFailure) {
      this.logger.warn(
        'Agent status unavailable for polling statuses',
        { error: result.error }
      );
      return new Set();
    }
    return result.value;
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return Array.isArray(data) ? { count: data.length } : data;
  }
}
