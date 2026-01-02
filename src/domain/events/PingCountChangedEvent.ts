import {
  PingCountChangedEventProps,
  DomainEvent,
  NetworkDeviceId,
  PollingConfigurationId
} from '../';

/**
 * PingCountChangedEvent - Number of ICMP pings per polling cycle has been modified.
 *
 * Published By: NetworkDevice Aggregate
 * Published When: Admin or system changes the ping count setting for a device's polling configuration
 *
 * Handlers:
 * - ConfigurationHistoryLogger: Records ping count changes for audit trail
 * - NotificationService: Alerts administrators of polling configuration changes
 * - PollingScheduler: Adjusts polling duration estimates based on new ping count
 * - MetricsQualityTracker: Updates expected metric precision calculations
 * - AuditLogger: Records configuration change for compliance
 *
 * Use Cases:
 * - Admin increases ping count for critical device to improve metric accuracy
 * - Admin decreases ping count to reduce network overhead for stable device
 * - System auto-adjusts ping count based on network conditions
 * - Configuration is optimized during troubleshooting to gather more data
 * - Bulk configuration update applies standard ping count to device group
 *
 * Business Rules:
 * - Ping count must be positive integer (typically 1-10)
 * - Higher ping counts (e.g., 10) provide:
 *   - Better statistical accuracy for latency and jitter
 *   - More reliable packet loss detection
 *   - Improved quality of performance trending
 * - Lower ping counts (e.g., 1-3) provide:
 *   - Faster polling completion
 *   - Reduced network bandwidth consumption
 *   - Lower processing overhead
 * - Event tracks both previous and new values for audit trail
 * - Configuration change applies to next polling cycle (not immediate)
 * - Change may affect polling duration and scheduling
 *
 * @example
 * ```typescript
 * const event = new PingCountChangedEvent({
 *   aggregateId: PollingConfigurationId.create().value,
 *   networkDeviceId: NetworkDeviceId.create().value,
 *   previousPingCount: 4,
 *   newPingCount: 10,
 *   deviceName: 'Critical-Core-Router',
 *   dateTimeOccurred: new Date()
 * });
 *
 * // Check if accuracy was improved
 * if (event.wasIncreased()) {
 *   // More accurate metrics, but slower polling
 * }
 * ```
 */
export class PingCountChangedEvent extends DomainEvent<PingCountChangedEventProps> {
  constructor(props: PingCountChangedEventProps) {
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

  get previousPingCount(): number {
    return this.props.previousPingCount;
  }

  get newPingCount(): number {
    return this.props.newPingCount;
  }

  get deviceName(): string {
    return this.props.deviceName;
  }

  /**
   * Gets the ping count change delta.
   */
  public getPingCountDelta(): number {
    return this.props.newPingCount - this.props.previousPingCount;
  }

  /**
   * Checks if the ping count was increased.
   */
  public wasIncreased(): boolean {
    return this.getPingCountDelta() > 0;
  }

  /**
   * Checks if the ping count was decreased.
   */
  public wasDecreased(): boolean {
    return this.getPingCountDelta() < 0;
  }
}
