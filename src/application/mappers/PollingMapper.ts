import { PollingResult } from '../../domain/entities/PollingResult';
import { PollingMetrics } from '../../domain/value-objects';
import {
  PollingResultDTO,
  PollingMetricsDTO
} from '../dtos';

/**
 * PollingMapper
 *
 * Maps domain objects related to polling to DTOs for presentation layer.
 * Follows the Data Mapper pattern to keep domain and application layers separate.
 */
export class PollingMapper {
  /**
   * Maps PollingMetrics value object to DTO.
   *
   * @param metrics - Domain PollingMetrics value object
   * @returns PollingMetricsDTO
   */
  public static toPollingMetricsDTO(
    metrics: PollingMetrics
  ): PollingMetricsDTO {
    return {
      // Multi-ping statistics
      responseTimes: [...metrics.responseTimes], // Clone array
      averageResponseTime: metrics.averageResponseTime,
      minResponseTime: metrics.minResponseTime,
      maxResponseTime: metrics.maxResponseTime,
      jitter: metrics.jitter,

      // Packet statistics
      packetsSent: metrics.totalPings,
      packetsReceived: metrics.successfulPings,
      packetLoss: metrics.packetLoss,

      // Other
      ttl: null // TODO: Add TTL support in future
    };
  }

  /**
   * Maps PollingResult aggregate to DTO.
   *
   * @param result - Domain PollingResult aggregate
   * @returns PollingResultDTO
   */
  public static toPollingResultDTO(
    result: PollingResult
  ): PollingResultDTO {
    return {
      id: result.pollingResultId.toString(),
      networkDeviceId: result.networkDeviceId.toString(),
      timestamp: result.timestamp,
      status: result.status,
      responseTimeMs: result.responseTimeMs,
      metrics: result.metrics
        ? this.toPollingMetricsDTO(result.metrics)
        : null,
      attemptNumber: result.attemptNumber,
      errorMessage: result.errorMessage,
      deviceStatus: result.deviceStatus
    };
  }

  /**
   * Maps array of PollingResults to array of DTOs.
   *
   * @param results - Array of domain PollingResult aggregates
   * @returns Array of PollingResultDTOs
   */
  public static toPollingResultDTOList(
    results: PollingResult[]
  ): PollingResultDTO[] {
    return results.map((result) => this.toPollingResultDTO(result));
  }

  /**
   * Extracts last poll statistics from PollingMetrics for DevicePollingStatusDTO.
   *
   * @param metrics - Domain PollingMetrics value object
   * @returns Statistics object or null
   */
  public static toLastPollStatistics(
    metrics: PollingMetrics | null
  ): {
    responseTimes: number[];
    average: number;
    min: number;
    max: number;
    jitter: number;
    packetLoss: number;
  } | null {
    if (!metrics) {
      return null;
    }

    return {
      responseTimes: [...metrics.responseTimes],
      average: metrics.averageResponseTime,
      min: metrics.minResponseTime,
      max: metrics.maxResponseTime,
      jitter: metrics.jitter,
      packetLoss: metrics.packetLoss
    };
  }
}
