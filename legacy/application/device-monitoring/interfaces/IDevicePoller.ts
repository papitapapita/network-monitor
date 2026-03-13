import { Result } from '../../../domain/shared/core';
import { Device } from '../../../domain/device-inventory/aggregates';
import { PollingMetrics } from '../../../domain/device-monitoring/value-objects';

/**
 * Interface for device polling implementations.
 *
 * Sprint 1: ICMP polling with multi-ping support (4 pings default, configurable 1-10)
 * Future Sprints: SNMP polling, custom protocols
 *
 * The poller implementation is responsible for:
 * 1. Executing the configured number of pings (device.pollingConfiguration.pingCount)
 * 2. Collecting response times from all successful pings
 * 3. Calculating statistics (average, min, max, jitter, packet loss)
 * 4. Returning comprehensive PollingMetrics
 *
 * @example
 * ```typescript
 * const icmpPoller: IDevicePoller = new IcmpDevicePoller();
 * const device = await deviceRepository.findById(deviceId);
 *
 * if (device.isSuccess && device.getValue()) {
 *   const metricsResult = await icmpPoller.poll(device.getValue());
 *
 *   if (metricsResult.isSuccess) {
 *     const metrics = metricsResult.getValue();
 *     console.log(`Sent ${metrics.packetsSent} pings, received ${metrics.packetsReceived}`);
 *     console.log(`Response times: ${metrics.responseTimes.join(', ')}ms`);
 *     console.log(`Average: ${metrics.averageResponseTime}ms, Jitter: ${metrics.jitter}ms`);
 *     console.log(`Packet loss: ${metrics.packetLoss}%`);
 *   }
 * }
 * ```
 */
export interface IDevicePoller {
  /**
   * Polls a network device and returns comprehensive metrics.
   *
   * Implementation details:
   * - Should respect device.pollingConfiguration.pingCount (1-10)
   * - Should execute pings sequentially or in parallel based on implementation
   * - Should calculate jitter (standard deviation of response times)
   * - Should track packet loss (sent vs received)
   * - Should handle partial success (some pings succeed, some fail)
   * - Should timeout based on reasonable defaults (e.g., 5s per ping)
   *
   * @param device - The Device to poll (contains IP, ping count configuration)
   * @returns Result containing PollingMetrics on success, or error message on failure
   *
   * Success cases:
   * - All pings successful: packetLoss = 0, all response times recorded
   * - Partial success: packetLoss > 0, only successful response times recorded
   *
   * Failure cases:
   * - All pings failed: Return Result.fail() with appropriate error message
   * - Network unreachable: Return Result.fail() with connectivity error
   * - Invalid device IP: Return Result.fail() with validation error
   * - Timeout: Return Result.fail() with timeout error
   */
  poll(device: Device): Promise<Result<PollingMetrics>>;

  /**
   * Checks if the poller can handle this device type.
   *
   * This allows for protocol-specific pollers:
   * - ICMP poller: supports all IP-based devices
   * - SNMP poller: only devices with SNMP enabled
   * - Custom protocol pollers: specific device types
   *
   * @param device - The Device to check
   * @returns true if this poller can poll the device, false otherwise
   */
  canPoll(device: Device): boolean;

  /**
   * Returns the protocol name this poller implements.
   *
   * Used for logging, monitoring, and debugging.
   *
   * @returns Protocol name (e.g., 'ICMP', 'SNMP', 'HTTP')
   */
  getProtocolName(): string;
}

/**
 * Configuration options for device polling.
 *
 * Used by poller implementations to customize behavior.
 */
export interface PollingOptions {
  /**
   * Timeout for each individual ping in milliseconds.
   * Default: 5000 (5 seconds)
   */
  timeoutMs?: number;

  /**
   * Delay between consecutive pings in milliseconds.
   * Default: 100 (0.1 seconds)
   *
   * Useful to avoid overwhelming the device or network.
   */
  delayBetweenPingsMs?: number;

  /**
   * Whether to execute pings in parallel or sequentially.
   * Default: false (sequential)
   *
   * Sequential: More accurate jitter calculation, lower network load
   * Parallel: Faster execution, higher network load
   */
  parallel?: boolean;

  /**
   * Packet size in bytes for ICMP pings.
   * Default: 56 (standard ping size)
   */
  packetSize?: number;

  /**
   * Time-to-live (TTL) for ICMP packets.
   * Default: 64 (standard TTL)
   */
  ttl?: number;
}
