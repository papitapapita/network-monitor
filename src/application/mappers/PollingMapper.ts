import { PollingResult, PollingMetrics } from '../../domain';
import { PollingResultDTO, PollingMetricsDTO } from '../dtos';

/**
 * Mapper for pure data structure transformation between Polling DTOs and Domain.
 *
 * Responsibilities (ONLY):
 * - Transform polling domain objects to DTOs
 * - Extract primitive values from Value Objects
 * - Flatten nested structures
 * - Convert domain enums to strings
 *
 * Does NOT:
 * - Validate business rules (use case responsibility)
 * - Create value objects (use case responsibility)
 * - Create domain entities (use case responsibility)
 * - Make business decisions (use case responsibility)
 * - Call repositories or external services
 * - Perform any side effects
 *
 * @see APPLICATION-MAPPER-STANDARD.md for complete specification
 */
export class PollingMapper {
  /**
   * Converts PollingMetrics value object to DTO.
   * Pure data transformation - extracts primitives from value object.
   *
   * @param metrics - Domain PollingMetrics value object
   * @returns PollingMetricsDTO with all metric data
   */
  public static toPollingMetricsDTO(
    metrics: PollingMetrics
  ): PollingMetricsDTO {
    return {
      // Multi-ping statistics (extract from value object)
      responseTimes: [...metrics.responseTimes], // Clone array for immutability
      averageResponseTime: metrics.averageResponseTime,
      minResponseTime: metrics.minResponseTime,
      maxResponseTime: metrics.maxResponseTime,
      jitter: metrics.jitter,

      // Packet statistics (map field names from domain to DTO)
      packetsSent: metrics.totalPings,
      packetsReceived: metrics.successfulPings,
      packetLoss: metrics.packetLoss,

      // Other metrics
      ttl: null // TTL not yet implemented in domain
    };
  }

  /**
   * Converts PollingResult aggregate to DTO.
   * Pure data transformation - extracts primitives and converts enums to strings.
   *
   * @param result - Domain PollingResult aggregate
   * @returns PollingResultDTO with complete polling result data
   */
  public static toPollingResultDTO(
    result: PollingResult
  ): PollingResultDTO {
    return {
      // Extract string IDs from Value Objects
      id: result.id.toString(),
      networkDeviceId: result.networkDeviceId.toString(),

      // Primitive fields
      timestamp: result.timestamp,
      attemptNumber: result.attemptNumber,
      errorMessage: result.errorMessage,

      // Extract string values from domain enums
      status: result.status.toString(),
      deviceStatus: result.deviceStatus.toString(),

      // Nested value object transformation
      metrics: result.metrics
        ? this.toPollingMetricsDTO(result.metrics)
        : null
    };
  }

  /**
   * Converts array of PollingResult aggregates to array of DTOs.
   * Maps each result using toPollingResultDTO.
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
   * Extracts poll statistics from PollingMetrics for summary views.
   * Pure data transformation - flattens value object into plain object.
   *
   * This is used for creating summary statistics without full DTO structure.
   * Returns null if no metrics are available.
   *
   * @param metrics - Domain PollingMetrics value object or null
   * @returns Statistics object or null if no metrics
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
      responseTimes: [...metrics.responseTimes], // Clone for immutability
      average: metrics.averageResponseTime,
      min: metrics.minResponseTime,
      max: metrics.maxResponseTime,
      jitter: metrics.jitter,
      packetLoss: metrics.packetLoss
    };
  }
}
