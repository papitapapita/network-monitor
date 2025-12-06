import ping from 'ping';
import { Result } from '@/core/Result';
import { IDevicePoller, PollingOptions } from '@/application/interfaces/IDevicePoller';
import { NetworkDevice } from '@/domain/entities';
import { PollingMetrics } from '@/domain/value-objects';

/**
 * ICMP-based device poller implementation.
 *
 * Executes multiple ICMP ping requests to a network device and collects
 * comprehensive metrics including response times, jitter, and packet loss.
 *
 * Features:
 * - Multi-ping support (1-10 pings, configurable via device.pollingConfiguration.pingCount)
 * - Statistical analysis (average, min, max, jitter)
 * - Packet loss tracking
 * - Configurable timeout and delays
 * - Sequential or parallel ping execution
 *
 * Uses the 'ping' npm package which provides cross-platform ICMP ping functionality.
 *
 * @example
 * ```typescript
 * const poller = new IcmpDevicePoller({
 *   timeoutMs: 5000,
 *   delayBetweenPingsMs: 100,
 *   parallel: false
 * });
 *
 * const device = await deviceRepository.findById(deviceId);
 * const metricsResult = await poller.poll(device.getValue());
 *
 * if (metricsResult.isSuccess) {
 *   const metrics = metricsResult.getValue();
 *   console.log(`Avg: ${metrics.averageResponseTime}ms, Jitter: ${metrics.jitter}ms`);
 * }
 * ```
 */
export class IcmpDevicePoller implements IDevicePoller {
  private readonly options: Required<PollingOptions>;

  /**
   * Default polling options.
   */
  private static readonly DEFAULT_OPTIONS: Required<PollingOptions> = {
    timeoutMs: 5000, // 5 seconds
    delayBetweenPingsMs: 100, // 0.1 seconds
    parallel: false, // Sequential for accurate jitter
    packetSize: 56, // Standard ping packet size
    ttl: 64, // Standard TTL
  };

  constructor(options?: Partial<PollingOptions>) {
    this.options = {
      ...IcmpDevicePoller.DEFAULT_OPTIONS,
      ...options,
    };
  }

  /**
   * Polls a network device using ICMP ping.
   *
   * Executes the configured number of pings and collects comprehensive metrics.
   */
  public async poll(device: NetworkDevice): Promise<Result<PollingMetrics>> {
    const ipAddress = device.ipAddress.value;
    const pingCount = device.pollingConfiguration.pingCount;

    // Validate IP address
    if (!ipAddress || ipAddress.trim().length === 0) {
      return Result.fail<PollingMetrics>('Invalid IP address: empty or null');
    }

    try {
      // Execute pings (sequential or parallel based on options)
      const pingResults = this.options.parallel
        ? await this.executePingsParallel(ipAddress, pingCount)
        : await this.executePingsSequential(ipAddress, pingCount);

      // Calculate metrics from ping results
      const metricsResult = this.calculateMetrics(pingResults, pingCount);
      return metricsResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Result.fail<PollingMetrics>(`ICMP polling failed: ${errorMessage}`);
    }
  }

  /**
   * Checks if this poller can handle the device.
   *
   * ICMP poller can poll any IP-based device.
   */
  public canPoll(device: NetworkDevice): boolean {
    // ICMP can poll any device with a valid IP address
    const ipAddress = device.ipAddress.value;
    return ipAddress !== null && ipAddress.trim().length > 0;
  }

  /**
   * Returns the protocol name.
   */
  public getProtocolName(): string {
    return 'ICMP';
  }

  /**
   * Executes pings sequentially with delays between them.
   *
   * Sequential execution provides more accurate jitter measurements
   * and reduces network load.
   */
  private async executePingsSequential(
    ipAddress: string,
    count: number
  ): Promise<PingResult[]> {
    const results: PingResult[] = [];

    for (let i = 0; i < count; i++) {
      const result = await this.executeSinglePing(ipAddress);
      results.push(result);

      // Delay before next ping (except for the last one)
      if (i < count - 1) {
        await this.delay(this.options.delayBetweenPingsMs);
      }
    }

    return results;
  }

  /**
   * Executes pings in parallel for faster execution.
   *
   * Parallel execution is faster but may be less accurate for jitter
   * and can generate higher network load.
   */
  private async executePingsParallel(
    ipAddress: string,
    count: number
  ): Promise<PingResult[]> {
    const pingPromises: Promise<PingResult>[] = [];

    for (let i = 0; i < count; i++) {
      pingPromises.push(this.executeSinglePing(ipAddress));
    }

    return Promise.all(pingPromises);
  }

  /**
   * Executes a single ICMP ping.
   */
  private async executeSinglePing(ipAddress: string): Promise<PingResult> {
    try {
      const response = await ping.promise.probe(ipAddress, {
        timeout: this.options.timeoutMs / 1000, // Convert to seconds
        min_reply: 1,
        packetSize: this.options.packetSize,
        extra: ['-t', String(this.options.ttl)], // TTL option
      });

      return {
        success: response.alive,
        responseTime: response.time === 'unknown' ? null : parseFloat(response.time),
        ttl: response.numeric_host ? this.options.ttl : null,
      };
    } catch (error) {
      // Ping failed (timeout, network error, etc.)
      return {
        success: false,
        responseTime: null,
        ttl: null,
      };
    }
  }

  /**
   * Calculates comprehensive metrics from ping results.
   */
  private calculateMetrics(
    pingResults: PingResult[],
    totalPings: number
  ): Result<PollingMetrics> {
    // Separate successful and failed pings
    const successfulPings = pingResults.filter((r) => r.success && r.responseTime !== null);
    const responseTimes = successfulPings
      .map((r) => r.responseTime!)
      .filter((t) => t !== null && t >= 0);

    const packetsReceived = successfulPings.length;
    const packetsSent = totalPings;
    const packetLoss = ((packetsSent - packetsReceived) / packetsSent) * 100;

    // If all pings failed, return early
    if (responseTimes.length === 0) {
      return Result.fail<PollingMetrics>(
        `All ${totalPings} ICMP pings failed (100% packet loss)`
      );
    }

    // Calculate statistics
    const averageResponseTime = this.calculateAverage(responseTimes);
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    const jitter = this.calculateJitter(responseTimes);

    // Get TTL from first successful ping
    const ttl = successfulPings.find((r) => r.ttl !== null)?.ttl || null;

    // Create PollingMetrics value object
    const metricsResult = PollingMetrics.create({
      responseTimes,
      averageResponseTime,
      minResponseTime,
      maxResponseTime,
      jitter,
      packetsSent,
      packetsReceived,
      packetLoss,
      ttl,
    });

    if (metricsResult.isFailure) {
      return Result.fail<PollingMetrics>(
        `Failed to create metrics: ${metricsResult.getErrorValue()}`
      );
    }

    return Result.ok<PollingMetrics>(metricsResult.getValue());
  }

  /**
   * Calculates the average of an array of numbers.
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return Number((sum / values.length).toFixed(2));
  }

  /**
   * Calculates jitter (standard deviation of response times).
   *
   * Jitter measures the variability in response times, which is important
   * for real-time applications like VoIP and video conferencing.
   */
  private calculateJitter(responseTimes: number[]): number {
    if (responseTimes.length <= 1) return 0;

    const avg = this.calculateAverage(responseTimes);
    const squaredDifferences = responseTimes.map((time) => Math.pow(time - avg, 2));
    const variance = this.calculateAverage(squaredDifferences);
    const standardDeviation = Math.sqrt(variance);

    return Number(standardDeviation.toFixed(2));
  }

  /**
   * Delays execution for the specified milliseconds.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Internal result structure for a single ping.
 */
interface PingResult {
  success: boolean;
  responseTime: number | null; // In milliseconds
  ttl: number | null;
}
