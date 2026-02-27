import {
  ValueObject,
  Result,
  Guard,
  PollingMetricsProps
} from '../../device-inventory';

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
 * Business Rules:
 * - responseTimes, totalPings, and successfulPings cannot be null or undefined
 * - responseTimes must be an array
 * - totalPings must be between 1 and 10
 * - successfulPings cannot exceed totalPings
 * - responseTimes array length must equal successfulPings count
 * - Each response time must be a valid number (not NaN)
 * - Each response time must be between 0 and 30000ms (30 seconds)
 * - All statistics are automatically calculated on creation
 * - Statistics are rounded to 2 decimal places
 *
 * @example
 * const metricsResult = PollingMetrics.create({
 *   responseTimes: [23.5, 24.1, 23.8, 24.3],
 *   totalPings: 4,
 *   successfulPings: 4
 * });
 *
 * if (metricsResult.isSuccess) {
 *   const metrics = metricsResult.value;
 *   console.log(metrics.averageResponseTime); // ~23.925
 *   console.log(metrics.jitter); // ~0.33
 *   console.log(metrics.packetLoss); // 0
 *   console.log(metrics.getQualityScore()); // 100
 * }
 */
export class PollingMetrics extends ValueObject<PollingMetricsProps> {
  public static readonly MAX_PING_COUNT = 10;
  public static readonly MIN_PING_COUNT = 1;
  public static readonly MAX_RESPONSE_TIME_MS = 30000; // 30 seconds

  get responseTimes(): readonly number[] {
    return Object.freeze([...this._props.responseTimes]);
  }

  get totalPings(): number {
    return this._props.totalPings;
  }

  get successfulPings(): number {
    return this._props.successfulPings;
  }

  get averageResponseTime(): number {
    return this._props.averageResponseTime;
  }

  get minResponseTime(): number {
    return this._props.minResponseTime;
  }

  get maxResponseTime(): number {
    return this._props.maxResponseTime;
  }

  get jitter(): number {
    return this._props.jitter;
  }

  get packetLoss(): number {
    return this._props.packetLoss;
  }

  private constructor(_props: PollingMetricsProps) {
    super(_props);
  }

  /**
   * Creates a new PollingMetrics value object.
   *
   * @param _props - Configuration with response times and ping counts
   * @returns Result containing PollingMetrics or error message
   */
  public static create(_props: {
    responseTimes: number[];
    totalPings: number;
    successfulPings: number;
  }): Result<PollingMetrics> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(
        _props.responseTimes,
        'responseTimes'
      ),
      Guard.againstNullOrUndefined(_props.totalPings, 'totalPings'),
      Guard.againstNullOrUndefined(
        _props.successfulPings,
        'successfulPings'
      ),
      Guard.isNumber(_props.totalPings, 'totalPings'),
      Guard.isNumber(_props.successfulPings, 'successfulPings'),
      Guard.inRange(
        _props.totalPings,
        this.MIN_PING_COUNT,
        this.MAX_PING_COUNT,
        'totalPings'
      )
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<PollingMetrics>(guardResult.message!);
    }

    if (!Array.isArray(_props.responseTimes)) {
      return Result.fail<PollingMetrics>(
        'responseTimes must be an array'
      );
    }

    if (_props.successfulPings > _props.totalPings) {
      return Result.fail<PollingMetrics>(
        'successfulPings cannot exceed totalPings'
      );
    }

    if (_props.responseTimes.length !== _props.successfulPings) {
      return Result.fail<PollingMetrics>(
        'responseTimes array length must equal successfulPings count'
      );
    }

    // Validate all response times are valid numbers
    for (let i = 0; i < _props.responseTimes.length; i++) {
      const responseTime = _props.responseTimes[i];
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
      _props.responseTimes
    );
    const minResponseTime = this.calculateMin(_props.responseTimes);
    const maxResponseTime = this.calculateMax(_props.responseTimes);
    const jitter = this.calculateStandardDeviation(
      _props.responseTimes
    );
    const packetLoss = this.calculatePacketLoss(
      _props.totalPings,
      _props.successfulPings
    );

    return Result.ok<PollingMetrics>(
      new PollingMetrics({
        responseTimes: [..._props.responseTimes], // Clone array for immutability
        totalPings: _props.totalPings,
        successfulPings: _props.successfulPings,
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
    return sum / values.length; // Round to 2 decimals
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
    return this._props.packetLoss === 0;
  }

  /**
   * Checks if all pings failed (100% packet loss).
   */
  public isCompleteFailure(): boolean {
    return this._props.packetLoss === 100;
  }

  /**
   * Checks if there was partial packet loss.
   */
  public hasPacketLoss(): boolean {
    return this._props.packetLoss > 0;
  }

  /**
   * Checks if jitter is above a given threshold (indicates instability).
   *
   * @param thresholdMs - Jitter threshold in milliseconds
   * @returns True if jitter exceeds threshold
   */
  public hasHighJitter(thresholdMs: number): boolean {
    return this._props.jitter > thresholdMs;
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
    score -= this._props.packetLoss / 2;

    // Deduct points for high jitter (up to -50 points)
    // Consider jitter above 50ms as degrading quality
    const jitterPenalty = Math.min(
      (this._props.jitter / 50) * 50,
      50
    );
    score -= jitterPenalty;

    return Math.max(0, Math.round(score));
  }

  /**
   * Returns a human-readable summary of the metrics.
   */
  public toDisplayString(): string {
    if (this.isCompleteFailure()) {
      return `Failed: ${this._props.totalPings}/${this._props.totalPings} packets lost`;
    }

    return (
      `Avg: ${this._props.averageResponseTime}ms, ` +
      `Min: ${this._props.minResponseTime}ms, ` +
      `Max: ${this._props.maxResponseTime}ms, ` +
      `Jitter: ${this._props.jitter}ms, ` +
      `Loss: ${this._props.packetLoss}%`
    );
  }

  /**
   * Returns a compact summary for logging.
   */
  public toString(): string {
    return `${this._props.averageResponseTime}ms avg (${this._props.successfulPings}/${this._props.totalPings} pings)`;
  }
}
