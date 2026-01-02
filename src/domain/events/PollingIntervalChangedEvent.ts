import {
  DomainEvent,
  PollingIntervalChangedEventProps,
  NetworkDeviceId,
  PollingInterval,
  PollingConfigurationId
} from '../';

/**
 * PollingIntervalChangedEvent - Time between polling cycles has been adjusted.
 *
 * Published By: NetworkDevice Aggregate
 * Published When: Admin or system modifies the polling interval (frequency) for a device
 *
 * Handlers:
 * - PollingScheduler: Reschedules device's next poll based on new interval
 * - ConfigurationHistoryLogger: Records interval changes for audit trail
 * - NotificationService: Alerts administrators of polling frequency changes
 * - ResourceEstimator: Updates capacity planning based on new polling load
 * - MetricsRetentionService: Adjusts data retention policies for metric density
 * - AuditLogger: Records configuration change for compliance
 *
 * Use Cases:
 * - Admin increases interval for stable device to reduce monitoring overhead
 * - Admin decreases interval for critical device requiring real-time monitoring
 * - System auto-adjusts interval based on device stability patterns
 * - Temporary interval reduction during troubleshooting for detailed data
 * - Bulk configuration applies standard intervals to device groups
 *
 * Business Rules:
 * - Polling interval must be positive duration (typically 10s to 1h)
 * - Shorter intervals (e.g., 30s) provide:
 *   - Faster outage detection
 *   - More granular metric time-series
 *   - Better real-time visibility into performance
 * - Longer intervals (e.g., 5-10min) provide:
 *   - Reduced network bandwidth consumption
 *   - Lower system CPU and database load
 *   - Decreased storage requirements for metrics
 * - Event tracks both previous and new interval values (in seconds)
 * - Change applies to next scheduled poll (not immediate)
 * - Scheduler must recalculate next poll time based on new interval
 * - Very short intervals (<10s) may require special authorization
 *
 * @example
 * ```typescript
 * const event = new PollingIntervalChangedEvent({
 *   aggregateId: PollingConfigurationId.create().value,
 *   networkDeviceId: NetworkDeviceId.create().value,
 *   previousInterval: PollingInterval.create(300).value, // 5 minutes
 *   newInterval: PollingInterval.create(60).value,       // 1 minute
 *   deviceName: 'Critical-Router-01',
 *   dateTimeOccurred: new Date()
 * });
 *
 * // Check if monitoring became more frequent
 * if (event.wasDecreased()) {
 *   // Faster monitoring, higher resource usage
 * }
 * ```
 */
export class PollingIntervalChangedEvent extends DomainEvent<PollingIntervalChangedEventProps> {
  constructor(props: PollingIntervalChangedEventProps) {
    super(props);
  }

  get aggregateId(): NetworkDeviceId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get pollingConfigurationId(): PollingConfigurationId {
    return this.props.pollingConfigurationId;
  }

  get previousInterval(): PollingInterval {
    return this.props.previousInterval;
  }

  get newInterval(): PollingInterval {
    return this.props.newInterval;
  }

  get deviceName(): string {
    return this.props.deviceName;
  }

  /**
   * Gets the interval change in seconds.
   */
  public getIntervalChangeDelta(): number {
    return (
      this.props.newInterval.seconds -
      this.props.previousInterval.seconds
    );
  }

  /**
   * Checks if the interval was increased.
   */
  public wasIncreased(): boolean {
    return this.getIntervalChangeDelta() > 0;
  }

  /**
   * Checks if the interval was decreased.
   */
  public wasDecreased(): boolean {
    return this.getIntervalChangeDelta() < 0;
  }
}
