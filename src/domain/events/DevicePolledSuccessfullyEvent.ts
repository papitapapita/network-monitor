import {
  DomainEvent,
  NetworkDeviceId,
  PollingMetrics,
  DevicePolledSuccessfullyEventProps,
  IPAddress,
  PollingResultId
} from '../';

/**
 * DevicePolledSuccessfullyEvent - Device responded successfully to network polling.
 *
 * Published By: PollingResult Aggregate
 * Published When: Device responds to ICMP ping and metrics are successfully collected
 *
 * Handlers:
 * - DeviceStatusUpdater: Sets device status to ONLINE if not already
 * - MetricsStorage: Persists latency, jitter, and packet loss to TimescaleDB
 * - SLATracker: Updates uptime calculations and availability metrics
 * - RecoveryNotifier: Sends recovery alerts if wasOffline=true (device came back)
 * - TrendAnalyzer: Analyzes metric trends for performance degradation
 * - HealthDashboard: Updates real-time monitoring displays with fresh data
 *
 * Use Cases:
 * - Regular polling cycle successfully collects metrics from healthy device
 * - Device recovers from offline state and responds to first ping
 * - Device responds after temporary network issue or maintenance
 * - Baseline metrics collection for new device after registration
 *
 * Business Rules:
 * - Event published for EVERY successful poll (high frequency)
 * - wasOffline flag distinguishes normal polls from recovery events
 * - Metrics (latency, jitter, packetLoss) must be valid measurements
 * - Recovery events (wasOffline=true) trigger special handling:
 *   - Send recovery notifications to administrators
 *   - Close open incidents automatically
 *   - Update status from OFFLINE→ONLINE
 * - Normal polls (wasOffline=false) only update metrics and SLA tracking
 * - Event aggregateId is PollingResultId (different from device ID)
 *
 * @example
 * ```typescript
 * // Regular successful poll
 * const event = new DevicePolledSuccessfullyEvent({
 *   aggregateId: PollingResultId.create().value,
 *   networkDeviceId: NetworkDeviceId.create().value,
 *   deviceName: 'Core-Router-01',
 *   ipAddress: '192.168.1.1',
 *   metrics: PollingMetrics.create({
 *     latency: 12.5,
 *     jitter: 1.2,
 *     packetLoss: 0.0
 *   }).value,
 *   wasOffline: false,
 *   dateTimeOccurred: new Date()
 * });
 *
 * // Device recovery
 * if (event.isRecovery()) {
 *   // Send recovery notification
 * }
 * ```
 */
export class DevicePolledSuccessfullyEvent extends DomainEvent<DevicePolledSuccessfullyEventProps> {
  constructor(props: DevicePolledSuccessfullyEventProps) {
    super(props);
  }

  get aggregateId(): PollingResultId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get networkDeviceId(): NetworkDeviceId {
    return this.props.networkDeviceId;
  }

  get deviceName(): string {
    return this.props.deviceName;
  }

  get ipAddress(): IPAddress {
    return this.props.ipAddress;
  }

  get metrics(): PollingMetrics {
    return this.props.metrics;
  }

  get wasOffline(): boolean {
    return this.props.wasOffline;
  }

  /**
   * Checks if this represents a device recovery (coming back online).
   */
  public isRecovery(): boolean {
    return this.props.wasOffline;
  }
}
