import { PollingConfiguration } from 'domain/device-monitoring/entities';
import { DeviceState } from 'domain/device-monitoring/aggregates';
import { PingResultRecord } from 'domain/device-monitoring/repository';
import {
  DevicePollingStatusDTO,
  PollingResultDTO,
  PollingMetricsDTO,
  PollingConfigurationDTO,
  SingleDevicePollingResultDTO,
  PollingHistoryDTO,
  CreateDevicePollingDTO,
  ConfigureDevicePollingDTO
} from '../dtos';

export class PollingMapper {
  public static toDTO(
    config: PollingConfiguration
  ): PollingConfigurationDTO {
    return {
      id: config.id.toString(),
      deviceId: config.deviceId.toString(),
      ipAddress: config.ipAddress?.value ?? null,
      intervalSeconds: config.interval.seconds,
      failuresBeforeDown: config.failuresBeforeDown.value,
      enabled: config.enabled
    };
  }

  public static extractCreateData(dto: CreateDevicePollingDTO) {
    return {
      deviceId: dto.deviceId,
      ipAddress: dto.ipAddress ?? null,
      intervalSeconds: dto.intervalSeconds ?? null,
      failuresBeforeDown: dto.failuresBeforeDown ?? null,
      enabled: dto.enabled ?? null
    };
  }

  public static extractUpdateData(dto: ConfigureDevicePollingDTO) {
    const updates: {
      intervalSeconds?: number;
      failuresBeforeDown?: number;
      enabled?: boolean;
    } = {};

    if (dto.intervalSeconds !== undefined) {
      updates.intervalSeconds = dto.intervalSeconds;
    }
    if (dto.failuresBeforeDown !== undefined) {
      updates.failuresBeforeDown = dto.failuresBeforeDown;
    }
    if (dto.enabled !== undefined) updates.enabled = dto.enabled;

    return updates;
  }

  public static toStatusDTO(
    config: PollingConfiguration,
    state: DeviceState | null,
    lastPing: PingResultRecord | null
  ): DevicePollingStatusDTO {
    const lastCheckedAt = state?.lastCheckedAt ?? null;
    // nextScheduled is a projection: last poll time + configured interval.
    // Null when the device has never been polled (no baseline to project from).
    const nextScheduled = lastCheckedAt
      ? new Date(
          lastCheckedAt.getTime() + config.interval.seconds * 1000
        )
      : null;

    return {
      deviceId: config.deviceId.toString(),
      pollingEnabled: config.enabled,
      intervalSeconds: config.interval.seconds,
      failuresBeforeDown: config.failuresBeforeDown.value,
      lastPolled: lastCheckedAt,
      nextScheduled,
      currentStatus: state
        ? state.isOnline
          ? 'ONLINE'
          : 'OFFLINE'
        : 'UNKNOWN',
      lastResult: lastPing
        ? this.toPingResultDTO(
            lastPing,
            config.deviceId.toString(),
            state
          )
        : null,
      consecutiveFailures: state?.consecutiveFailures ?? 0
    };
  }

  public static toSkippedResultDTO(
    deviceId: string,
    timestamp: Date
  ): SingleDevicePollingResultDTO {
    return {
      deviceId: deviceId,
      status: 'SKIPPED',
      message: 'Polling is disabled for this device',
      timestamp,
      metrics: null,
      deviceStatus: 'UNKNOWN'
    };
  }

  public static toPollResultDTO(params: {
    deviceId: string;
    isReachable: boolean;
    latencyMs: number | null;
    isOnline: boolean;
    consecutiveFailures: number;
    timestamp: Date;
  }): SingleDevicePollingResultDTO {
    const {
      deviceId,
      isReachable,
      latencyMs,
      isOnline,
      consecutiveFailures,
      timestamp
    } = params;

    return {
      deviceId: deviceId,
      status: isReachable ? 'SUCCESS' : 'FAILED',
      message: isReachable
        ? `Device responded in ${latencyMs}ms`
        : `Device did not respond (${consecutiveFailures} consecutive failure(s))`,
      timestamp,
      metrics:
        isReachable && latencyMs !== null
          ? this.toMetricsDTO(latencyMs)
          : null,
      deviceStatus: isOnline ? 'ONLINE' : 'OFFLINE'
    };
  }

  public static toHistoryDTO(
    page: PingResultRecord[],
    deviceId: string,
    totalCount: number
  ): PollingHistoryDTO {
    const successCount = page.filter((r) => r.isReachable).length;
    const latencies = page
      .filter((r) => r.isReachable && r.latencyMs !== null)
      .map((r) => r.latencyMs as number);

    const successRate =
      totalCount > 0 ? (successCount / totalCount) * 100 : 0;
    const averageResponseTime =
      latencies.length > 0
        ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
        : 0;
    const minResponseTime =
      latencies.length > 0 ? Math.min(...latencies) : 0;
    const maxResponseTime =
      latencies.length > 0 ? Math.max(...latencies) : 0;

    return {
      deviceId,
      results: page.map((r) =>
        this.toPingResultDTO(r, deviceId, null)
      ),
      totalCount,
      statistics: {
        successRate,
        averageResponseTime,
        minResponseTime,
        maxResponseTime,
        uptimePercentage: successRate
      }
    };
  }

  private static toPingResultDTO(
    ping: PingResultRecord,
    deviceId: string,
    state: DeviceState | null
  ): PollingResultDTO {
    return {
      id: ping.id,
      deviceId,
      timestamp: ping.checkedAt,
      status: ping.isReachable ? 'SUCCESS' : 'FAILED',
      metrics:
        ping.isReachable && ping.latencyMs !== null
          ? this.toMetricsDTO(ping.latencyMs)
          : null,
      // When no live state is available, fall back to the ping result itself
      // as the best available indicator of device status at that moment.
      deviceStatus: state
        ? state.isOnline
          ? 'ONLINE'
          : 'OFFLINE'
        : ping.isReachable
          ? 'ONLINE'
          : 'OFFLINE'
    };
  }

  private static toMetricsDTO(latencyMs: number): PollingMetricsDTO {
    return { latencyMs };
  }
}
