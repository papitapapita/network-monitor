/**
 * PollingMetricsDTO
 *
 * Performance metrics captured during a single ICMP ping.
 * Returned as part of PollingResultDTO and SingleDevicePollingResultDTO.
 */
export interface PollingMetricsDTO {
  /**
   * Round-trip latency in milliseconds.
   */
  latencyMs: number;
}
