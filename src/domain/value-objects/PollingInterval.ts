import {
  ValueObject,
  Result,
  Guard,
  PollingIntervalProps
} from '../';

/**
 * PollingInterval Value Object
 *
 * Represents the time interval between consecutive polls of a network device.
 * Measured in seconds with a valid range of 1 second to 24 hours (86400 seconds).
 *
 * Used to configure how frequently devices should be polled for status updates.
 *
 * Business Rules:
 * - Interval cannot be null or undefined
 * - Must be between 1 second and 86400 seconds (24 hours)
 * - Must be a valid number
 * - Automatically rounded to nearest integer
 * - Minimum interval: 1 second (prevents excessive polling)
 * - Maximum interval: 24 hours (ensures devices are checked daily)
 *
 * @example
 * const interval1 = PollingInterval.create(60);
 * if (interval1.isSuccess) {
 *   const interval = interval1.value;
 *   console.log(interval.seconds); // 60
 *   console.log(interval.toMilliseconds()); // 60000
 *   console.log(interval.toDisplayString()); // '1 minute'
 * }
 *
 * @example
 * const interval2 = PollingInterval.fromMinutes(5); // 5 minutes = 300 seconds
 * const interval3 = PollingInterval.fromHours(1); // 1 hour = 3600 seconds
 */
export class PollingInterval extends ValueObject<PollingIntervalProps> {
  public static readonly MIN_SECONDS = 1;
  public static readonly MAX_SECONDS = 86400; // 24 hours

  get seconds(): number {
    return this.props.seconds;
  }

  private constructor(props: PollingIntervalProps) {
    super(props);
  }

  /**
   * Creates a new PollingInterval from seconds.
   *
   * @param seconds - Interval in seconds (1-86400)
   * @returns Result containing PollingInterval or error message
   */
  public static create(seconds: number): Result<PollingInterval> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(
        seconds,
        'polling interval seconds'
      ),
      Guard.isNumber(seconds, 'polling interval seconds'),
      Guard.inRange(
        seconds,
        this.MIN_SECONDS,
        this.MAX_SECONDS,
        'polling interval'
      )
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<PollingInterval>(guardResult.message!);
    }

    // Ensure it's an integer
    const roundedSeconds = Math.round(seconds);

    return Result.ok<PollingInterval>(
      new PollingInterval({ seconds: roundedSeconds })
    );
  }

  /**
   * Creates a PollingInterval from minutes.
   *
   * @param minutes - Interval in minutes (0.017-1440)
   * @returns Result containing PollingInterval or error message
   *
   * @example
   * const interval = PollingInterval.fromMinutes(5); // 300 seconds
   */
  public static fromMinutes(
    minutes: number
  ): Result<PollingInterval> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(
        minutes,
        'polling interval minutes'
      ),
      Guard.isNumber(minutes, 'polling interval minutes')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<PollingInterval>(guardResult.message!);
    }

    const seconds = Math.round(minutes * 60);
    return this.create(seconds);
  }

  /**
   * Creates a PollingInterval from hours.
   *
   * @param hours - Interval in hours (0.0003-24)
   * @returns Result containing PollingInterval or error message
   *
   * @example
   * const interval = PollingInterval.fromHours(1); // 3600 seconds
   */
  public static fromHours(hours: number): Result<PollingInterval> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(hours, 'polling interval hours'),
      Guard.isNumber(hours, 'polling interval hours')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<PollingInterval>(guardResult.message!);
    }

    const seconds = Math.round(hours * 3600);
    return this.create(seconds);
  }

  /**
   * Converts the polling interval to milliseconds.
   * Useful for setTimeout/setInterval in JavaScript.
   *
   * @returns Interval in milliseconds
   */
  public toMilliseconds(): number {
    return this.props.seconds * 1000;
  }

  /**
   * Converts the polling interval to minutes.
   *
   * @returns Interval in minutes (rounded to 2 decimal places)
   */
  public toMinutes(): number {
    return Math.round((this.props.seconds / 60) * 100) / 100;
  }

  /**
   * Converts the polling interval to hours.
   *
   * @returns Interval in hours (rounded to 2 decimal places)
   */
  public toHours(): number {
    return Math.round((this.props.seconds / 3600) * 100) / 100;
  }

  /**
   * Returns a human-readable string representation.
   *
   * @returns String like "60 seconds", "5 minutes", or "1 hour"
   */
  public toDisplayString(): string {
    const { seconds } = this.props;

    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }

    if (seconds < 3600) {
      const minutes = Math.round(seconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    const hours = Math.round(seconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  /**
   * Returns the numeric value in seconds.
   */
  public toString(): string {
    return this.props.seconds.toString();
  }
}
