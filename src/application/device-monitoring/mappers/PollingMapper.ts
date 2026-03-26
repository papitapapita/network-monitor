import { PollingConfiguration } from 'domain/device-monitoring/entities';
import { DeviceState } from 'domain/device-monitoring/aggregates';
import { PingResultRecord } from 'domain/device-monitoring/repository';
import {
  DevicePollingStatusDTO,
  PollingResultDTO,
  PollingMetricsDTO,
  SingleDevicePollingResultDTO,
  PollingHistoryDTO
} from '../dtos';

/**
 * PollingMapper
 *
 * Pure data transformation between device-monitoring domain objects and
 * application-layer DTOs.
 *
 * Responsibilities (ONLY):
 * - Extract primitive values from domain entities and value objects.
 * - Assemble response DTOs from the combination of domain objects.
 * - Compute derived fields (nextScheduled, statistics, online status text).
 *
 * Does NOT:
 * - Validate business rules (entity/value object responsibility).
 * - Call repositories or perform side effects.
 * - Make decisions about whether polling should run.
 */
export class PollingMapper {
  // ============================================================================
  // Status DTO
  // ============================================================================

  /**
   * Assembles a DevicePollingStatusDTO from the three domain objects
   * that back the GET /devices/:id/polling/status endpoint.
   */
  public static toStatusDTO(
    config: PollingConfiguration,
    state: DeviceState | null,
    lastPing: PingResultRecord | null
  ): DevicePollingStatusDTO {
    const lastCheckedAt = state?.lastCheckedAt ?? null;
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

  // ============================================================================
  // Execute-cycle result DTO
  // ============================================================================

  /**
   * Builds the SingleDevicePollingResultDTO for a skipped polling cycle
   * (polling disabled and forceExecution is false).
   */
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

  /**
   * Builds the SingleDevicePollingResultDTO returned after a manual or
   * scheduled poll execution.
   */
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

  // ============================================================================
  // History DTO
  // ============================================================================

  /**
   * Converts a page of PingResultRecords plus aggregate statistics into
   * the full PollingHistoryDTO for the GET /devices/:id/polling/history endpoint.
   */
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

  // ============================================================================
  // Private helpers
  // ============================================================================

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
