import { ValueObject } from '../shared/kernel/ValueObject';
import { Result } from '../shared/kernel/Result';
import { Guard } from '../shared/kernel/Guard';

/**
 * PollingMetrics Value Object
 *
 * Encapsulates statistical metrics from a multi-ping polling operation.
 * Stores individual response times and calculates aggregate statistics including:
 * - Average response time
 * - Minimum response time
 * - Maximum response time
 * - Jitter (standard deviation of response times)
 * - Packet loss percentage
 *
 * This value object is immutable and all statistics are calculated on creation.
 *
 * @example
 * const metrics = PollingMetrics.create({
 *   responseTimes: [23.5, 24.1, 23.8, 24.3],
 *   totalPings: 4,
 *   successfulPings: 4
 * });
 *
 * console.log(metrics.averageResponseTime); // ~23.925
 * console.log(metrics.jitter); // ~0.33
 * console.log(metrics.packetLoss); // 0
 */

interface PollingMetricsProps {
  responseTimes: number[]; // Response times in milliseconds for successful pings
  totalPings: number; // Total number of pings attempted
  successfulPings: number; // Number of successful pings (length of responseTimes)
  averageResponseTime: number; // Calculated average in ms
  minResponseTime: number; // Minimum response time in ms
  maxResponseTime: number; // Maximum response time in ms
  jitter: number; // Standard deviation of response times
  packetLoss: number; // Packet loss percentage (0-100)
}

export class PollingMetrics extends ValueObject<PollingMetricsProps> {
  public static readonly MAX_PING_COUNT = 10;
  public static readonly MIN_PING_COUNT = 1;
  public static readonly MAX_RESPONSE_TIME_MS = 30000; // 30 seconds

  get responseTimes(): readonly number[] {
    return Object.freeze([...this.props.responseTimes]);
  }

  get totalPings(): number {
    return this.props.totalPings;
  }

  get successfulPings(): number {
    return this.props.successfulPings;
  }

  get averageResponseTime(): number {
    return this.props.averageResponseTime;
  }

  get minResponseTime(): number {
    return this.props.minResponseTime;
  }

  get maxResponseTime(): number {
    return this.props.maxResponseTime;
  }

  get jitter(): number {
    return this.props.jitter;
  }

  get packetLoss(): number {
    return this.props.packetLoss;
  }

  private constructor(props: PollingMetricsProps) {
    super(props);
  }

  /**
   * Creates a new PollingMetrics value object.
   *
   * @param props - Configuration with response times and ping counts
   * @returns Result containing PollingMetrics or error message
   */
  public static create(props: {
    responseTimes: number[];
    totalPings: number;
    successfulPings: number;
  }): Result<PollingMetrics> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(
        props.responseTimes,
        'responseTimes'
      ),
      Guard.againstNullOrUndefined(props.totalPings, 'totalPings'),
      Guard.againstNullOrUndefined(
        props.successfulPings,
        'successfulPings'
      ),
      Guard.isNumber(props.totalPings, 'totalPings'),
      Guard.isNumber(props.successfulPings, 'successfulPings'),
      Guard.inRange(
        props.totalPings,
        this.MIN_PING_COUNT,
        this.MAX_PING_COUNT,
        'totalPings'
      )
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<PollingMetrics>(guardResult.message!);
    }

    if (!Array.isArray(props.responseTimes)) {
      return Result.fail<PollingMetrics>(
        'responseTimes must be an array'
      );
    }

    if (props.successfulPings > props.totalPings) {
      return Result.fail<PollingMetrics>(
        'successfulPings cannot exceed totalPings'
      );
    }

    if (props.responseTimes.length !== props.successfulPings) {
      return Result.fail<PollingMetrics>(
        'responseTimes array length must equal successfulPings count'
      );
    }

    // Validate all response times are valid numbers
    for (let i = 0; i < props.responseTimes.length; i++) {
      const responseTime = props.responseTimes[i];
      if (typeof responseTime !== 'number' || isNaN(responseTime)) {
        return Result.fail<PollingMetrics>(
          `Invalid response time at index ${i}: ${responseTime}`
        );
      }
      if (
        responseTime < 0 ||
        responseTime > this.MAX_RESPONSE_TIME_MS
      ) {
        return Result.fail<PollingMetrics>(
          `Response time at index ${i} out of range: ${responseTime}ms`
        );
      }
    }

    // Calculate statistics
    const averageResponseTime = this.calculateAverage(
      props.responseTimes
    );
    const minResponseTime = this.calculateMin(props.responseTimes);
    const maxResponseTime = this.calculateMax(props.responseTimes);
    const jitter = this.calculateStandardDeviation(
      props.responseTimes
    );
    const packetLoss = this.calculatePacketLoss(
      props.totalPings,
      props.successfulPings
    );

    return Result.ok<PollingMetrics>(
      new PollingMetrics({
        responseTimes: [...props.responseTimes], // Clone array for immutability
        totalPings: props.totalPings,
        successfulPings: props.successfulPings,
        averageResponseTime,
        minResponseTime,
        maxResponseTime,
        jitter,
        packetLoss
      })
    );
  }

  /**
   * Creates PollingMetrics for a completely failed poll (all pings failed).
   *
   * @param totalPings - Number of pings that were attempted
   * @returns PollingMetrics with 100% packet loss
   */
  public static createForFailedPoll(
    totalPings: number
  ): Result<PollingMetrics> {
    return this.create({
      responseTimes: [],
      totalPings,
      successfulPings: 0
    });
  }

  /**
   * Calculates the average of an array of numbers.
   */
  private static calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return Math.round((sum / values.length) * 100) / 100; // Round to 2 decimals
  }

  /**
   * Finds the minimum value in an array.
   */
  private static calculateMin(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.min(...values);
  }

  /**
   * Finds the maximum value in an array.
   */
  private static calculateMax(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.max(...values);
  }

  /**
   * Calculates standard deviation (jitter) of response times.
   * Uses population standard deviation formula.
   */
  private static calculateStandardDeviation(
    values: number[]
  ): number {
    if (values.length === 0) return 0;
    if (values.length === 1) return 0; // No variance with single value

    const avg = this.calculateAverage(values); //23.93
    const squaredDifferences = values.map((val) =>
      Math.pow(val - avg, 2)
    );
    const variance =
      squaredDifferences.reduce((acc, val) => acc + val, 0) /
      values.length;
    const stdDev = Math.sqrt(variance);

    return Math.round(stdDev * 100) / 100; // Round to 2 decimals
  }

  /**
   * Calculates packet loss percentage.
   */
  private static calculatePacketLoss(
    totalPings: number,
    successfulPings: number
  ): number {
    if (totalPings === 0) return 0;
    const lossPercentage =
      ((totalPings - successfulPings) / totalPings) * 100;
    return Math.round(lossPercentage * 100) / 100; // Round to 2 decimals
  }

  /**
   * Checks if all pings were successful (no packet loss).
   */
  public isFullySuccessful(): boolean {
    return this.props.packetLoss === 0;
  }

  /**
   * Checks if all pings failed (100% packet loss).
   */
  public isCompleteFailure(): boolean {
    return this.props.packetLoss === 100;
  }

  /**
   * Checks if there was partial packet loss.
   */
  public hasPacketLoss(): boolean {
    return this.props.packetLoss > 0;
  }

  /**
   * Checks if jitter is above a given threshold (indicates instability).
   *
   * @param thresholdMs - Jitter threshold in milliseconds
   * @returns True if jitter exceeds threshold
   */
  public hasHighJitter(thresholdMs: number): boolean {
    return this.props.jitter > thresholdMs;
  }

  /**
   * Returns a quality score (0-100) based on packet loss and jitter.
   * 100 = perfect (no loss, low jitter)
   * 0 = worst (100% loss or extreme jitter)
   */
  public getQualityScore(): number {
    if (this.isCompleteFailure()) return 0;

    // Start with 100 and deduct points
    let score = 100;

    // Deduct points for packet loss (up to -50 points)
    score -= this.props.packetLoss / 2;

    // Deduct points for high jitter (up to -50 points)
    // Consider jitter above 50ms as degrading quality
    const jitterPenalty = Math.min((this.props.jitter / 50) * 50, 50);
    score -= jitterPenalty;

    return Math.max(0, Math.round(score));
  }

  /**
   * Returns a human-readable summary of the metrics.
   */
  public toDisplayString(): string {
    if (this.isCompleteFailure()) {
      return `Failed: ${this.props.totalPings}/${this.props.totalPings} packets lost`;
    }

    return (
      `Avg: ${this.props.averageResponseTime}ms, ` +
      `Min: ${this.props.minResponseTime}ms, ` +
      `Max: ${this.props.maxResponseTime}ms, ` +
      `Jitter: ${this.props.jitter}ms, ` +
      `Loss: ${this.props.packetLoss}%`
    );
  }

  /**
   * Returns a compact summary for logging.
   */
  public toString(): string {
    return `${this.props.averageResponseTime}ms avg (${this.props.successfulPings}/${this.props.totalPings} pings)`;
  }
}
