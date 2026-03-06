/**
 * PollingMetricsDTO
 *
 * Data Transfer Object for polling metrics with multi-ping statistics.
 * Used to transfer polling metric data between application layer and presentation layer.
 *
 * This DTO is designed to support both Sprint 1 (ICMP/ping) and future
 * Sprint 2+ features (SNMP metrics).
 */

export interface PollingMetricsDTO {
  // ============================================================================
  // Multi-ping statistics (Sprint 1)
  // ============================================================================

  /**
   * Array of individual ping response times in milliseconds.
   * Example: [23.5, 24.1, 23.8, 24.3] for 4 pings
   */
  responseTimes: number[];

  /**
   * Average (mean) of all response times in milliseconds.
   */
  averageResponseTime: number;

  /**
   * Minimum response time from all pings in milliseconds.
   */
  minResponseTime: number;

  /**
   * Maximum response time from all pings in milliseconds.
   */
  maxResponseTime: number;

  /**
   * Jitter (standard deviation of response times) in milliseconds.
   * Indicates network stability - lower is better.
   */
  jitter: number;

  // ============================================================================
  // Packet statistics (Sprint 1)
  // ============================================================================

  /**
   * Total number of ICMP packets sent.
   */
  packetsSent: number;

  /**
   * Total number of ICMP packets received.
   */
  packetsReceived: number;

  /**
   * Packet loss percentage (0-100).
   * Example: 25 means 25% packet loss
   */
  packetLoss: number;

  // ============================================================================
  // Other ICMP metrics (Sprint 1)
  // ============================================================================

  /**
   * Time To Live (TTL) from ICMP response.
   * Null if not available.
   */
  ttl: number | null;

  // ============================================================================
  // Future SNMP metrics (Sprint 2+)
  // ============================================================================

  /**
   * Device uptime in seconds.
   * Available when SNMP is enabled (Sprint 2+).
   */
  uptime?: number;

  /**
   * Device temperature in Celsius.
   * Available when SNMP is enabled (Sprint 2+).
   * Null if device doesn't support temperature monitoring.
   */
  temperature?: number | null;

  /**
   * CPU usage percentage (0-100).
   * Available when SNMP is enabled (Sprint 2+).
   */
  cpuUsage?: number;

  /**
   * Memory usage percentage (0-100).
   * Available when SNMP is enabled (Sprint 2+).
   */
  memoryUsage?: number;

  /**
   * Signal strength in dBm (for wireless devices).
   * Available when SNMP is enabled (Sprint 2+).
   * Null if device is not wireless.
   */
  signalStrength?: number | null;

  /**
   * Receive throughput in bits per second.
   * Available when SNMP is enabled (Sprint 2+).
   */
  throughputRx?: number;

  /**
   * Transmit throughput in bits per second.
   * Available when SNMP is enabled (Sprint 2+).
   */
  throughputTx?: number;
}
