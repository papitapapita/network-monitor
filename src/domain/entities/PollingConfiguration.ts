import { Entity, Result, Guard } from '../shared/kernel';
import { PollingConfigurationId } from './PollingConfigurationId';
import { NetworkDeviceId } from './NetworkDeviceId';
import { PollingInterval, RetryPolicy } from '../value-objects';
import { PollingConfigurationProps } from '../shared/props';

/**
 * PollingConfiguration Entity
 *
 * Represents the polling configuration for a network device.
 * This is an entity within the NetworkDevice aggregate that defines
 * how and when a device should be polled for connectivity/metrics.
 *
 * Key responsibilities:
 * - Configure polling interval and ping count
 * - Manage enabled/disabled state
 * - Schedule next poll execution
 * - Define retry behavior
 */
export class PollingConfiguration extends Entity<
  PollingConfigurationProps,
  PollingConfigurationId
> {
  public static readonly MIN_PING_COUNT = 1;
  public static readonly MAX_PING_COUNT = 10;
  public static readonly DEFAULT_PING_COUNT = 4;

  private constructor(
    props: PollingConfigurationProps,
    id: PollingConfigurationId
  ) {
    super(props, id);
  }

  get networkDeviceId(): NetworkDeviceId {
    return this.props.networkDeviceId;
  }

  get interval(): PollingInterval {
    return this.props.interval;
  }

  get enabled(): boolean {
    return this.props.enabled;
  }

  get retryPolicy(): RetryPolicy {
    return this.props.retryPolicy;
  }

  get pingCount(): number {
    return this.props.pingCount;
  }

  get lastScheduledAt(): Date | null {
    return this.props.lastScheduledAt;
  }

  get nextScheduledAt(): Date | null {
    return this.props.nextScheduledAt;
  }

  /**
   * Creates a new PollingConfiguration entity.
   *
   * @param props - Polling configuration properties
   * @param id - Optional ID (for reconstitution from database)
   * @returns Result containing PollingConfiguration or error message
   */
  public static create(
    props: PollingConfigurationProps,
    id?: PollingConfigurationId
  ): Result<PollingConfiguration> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(
        props.networkDeviceId,
        'networkDeviceId'
      ),
      Guard.againstNullOrUndefined(props.interval, 'interval'),
      Guard.againstNullOrUndefined(props.enabled, 'enabled'),
      Guard.againstNullOrUndefined(props.retryPolicy, 'retryPolicy'),
      Guard.againstNullOrUndefined(props.pingCount, 'pingCount'),
      Guard.isNumber(props.pingCount, 'pingCount'),
      Guard.inRange(
        props.pingCount,
        this.MIN_PING_COUNT,
        this.MAX_PING_COUNT,
        'pingCount'
      )
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<PollingConfiguration>(guardResult.message!);
    }

    // pingCount must be an integer
    const roundedPingCount = Math.round(props.pingCount);

    const pollingConfigurationId =
      id || PollingConfigurationId.create().value;

    const pollingConfiguration = new PollingConfiguration(
      {
        ...props,
        pingCount: roundedPingCount
      },
      pollingConfigurationId
    );

    return Result.ok<PollingConfiguration>(pollingConfiguration);
  }

  /**
   * Creates a default PollingConfiguration with standard settings.
   *
   * @param networkDeviceId - The network device this config belongs to
   * @param interval - Polling interval
   * @returns Result containing PollingConfiguration with defaults
   */
  public static createDefault(
    networkDeviceId: NetworkDeviceId,
    interval?: PollingInterval
  ): Result<PollingConfiguration> {
    return this.create({
      networkDeviceId,
      interval: interval || PollingInterval.create(300).value, // Default 5 minutes
      enabled: true,
      retryPolicy: RetryPolicy.createDefault(),
      pingCount: this.DEFAULT_PING_COUNT,
      lastScheduledAt: null,
      nextScheduledAt: null
    });
  }

  /**
   * Enables polling for this configuration.
   *
   * @returns Result indicating success or failure, and whether state changed
   */
  public enable(): Result<{ stateChanged: boolean }> {
    if (this.props.enabled) {
      return Result.ok<{ stateChanged: boolean }>({ stateChanged: false });
    }

    this.props.enabled = true;
    return Result.ok<{ stateChanged: boolean }>({ stateChanged: true });
  }

  /**
   * Disables polling for this configuration.
   *
   * @returns Result indicating success or failure, and whether state changed
   */
  public disable(): Result<{ stateChanged: boolean }> {
    if (!this.props.enabled) {
      return Result.ok<{ stateChanged: boolean }>({ stateChanged: false });
    }

    this.props.enabled = false;
    this.props.nextScheduledAt = null; // Clear scheduled time when disabled
    return Result.ok<{ stateChanged: boolean }>({ stateChanged: true });
  }

  /**
   * Updates the polling interval.
   * This will require rescheduling the next poll.
   *
   * @param newInterval - New polling interval
   * @returns Result indicating success or failure, and the previous interval for event emission
   */
  public updateInterval(newInterval: PollingInterval): Result<{ previousInterval: PollingInterval }> {
    const guardResult = Guard.againstNullOrUndefined(
      newInterval,
      'interval'
    );
    if (!guardResult.succeeded) {
      return Result.fail<{ previousInterval: PollingInterval }>(guardResult.message!);
    }

    const previousInterval = this.props.interval;
    this.props.interval = newInterval;

    // Reschedule next poll if enabled
    if (this.props.enabled && this.props.lastScheduledAt) {
      const scheduleResult = this.scheduleNext(
        this.props.lastScheduledAt
      );
      if (scheduleResult.isFailure) {
        return Result.fail<{ previousInterval: PollingInterval }>(scheduleResult.error!);
      }
    }

    return Result.ok<{ previousInterval: PollingInterval }>({ previousInterval });
  }

  /**
   * Updates the ping count for multi-ping polling.
   *
   * @param count - New ping count (1-10)
   * @returns Result indicating success or failure, and the previous ping count for event emission
   */
  public updatePingCount(count: number): Result<{ previousPingCount: number }> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(count, 'pingCount'),
      Guard.isNumber(count, 'pingCount'),
      Guard.inRange(
        count,
        PollingConfiguration.MIN_PING_COUNT,
        PollingConfiguration.MAX_PING_COUNT,
        'pingCount'
      )
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<{ previousPingCount: number }>(guardResult.message!);
    }

    const previousPingCount = this.props.pingCount;
    this.props.pingCount = Math.round(count);
    return Result.ok<{ previousPingCount: number }>({ previousPingCount });
  }

  /**
   * Updates the retry policy.
   *
   * @param newRetryPolicy - New retry policy
   * @returns Result indicating success or failure
   */
  public updateRetryPolicy(
    newRetryPolicy: RetryPolicy
  ): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(
      newRetryPolicy,
      'retryPolicy'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    this.props.retryPolicy = newRetryPolicy;
    return Result.ok<void>();
  }

  /**
   * Schedules the next poll based on the interval.
   *
   * @param fromTime - Time to calculate next poll from (usually current time or last poll time)
   * @returns Result indicating success or failure
   */
  public scheduleNext(fromTime: Date): Result<void> {
    if (!this.props.enabled) {
      return Result.fail<void>(
        'Cannot schedule poll - polling is disabled'
      );
    }

    const guardResult = Guard.againstNullOrUndefined(
      fromTime,
      'fromTime'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    // Calculate next scheduled time
    const intervalMs = this.props.interval.toMilliseconds();
    const nextTime = new Date(fromTime.getTime() + intervalMs);

    this.props.lastScheduledAt = fromTime;
    this.props.nextScheduledAt = nextTime;

    return Result.ok<void>();
  }

  /**
   * Checks if a poll can be executed at the given time.
   *
   * @param currentTime - Current time to check against
   * @returns True if polling should occur now, false otherwise
   */
  public canPoll(currentTime: Date): boolean {
    if (!this.props.enabled) {
      return false;
    }

    if (!this.props.nextScheduledAt) {
      // Never scheduled - can poll now
      return true;
    }

    // Can poll if current time is at or past scheduled time
    return currentTime >= this.props.nextScheduledAt;
  }

  /**
   * Gets a human-readable description of the configuration.
   */
  public toDisplayString(): string {
    const status = this.props.enabled ? 'Enabled' : 'Disabled';
    const interval = this.props.interval.toDisplayString();
    const pings = `${this.props.pingCount} ping${this.props.pingCount !== 1 ? 's' : ''}`;

    return `${status}, ${interval}, ${pings} per poll`;
  }
}
