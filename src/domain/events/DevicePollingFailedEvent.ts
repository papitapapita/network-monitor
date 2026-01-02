import {
  DomainEvent,
  DevicePollingFailedEventProps,
  NetworkDeviceId,
  PollingStatus,
  PollingResultId,
  IPAddress
} from '../';

/**
 * DevicePollingFailedEvent - Device failed to respond to network polling after all retry attempts.
 *
 * Published By: PollingResult Aggregate
 * Published When: All polling retry attempts exhausted with no successful response (TIMEOUT or FAILED)
 *
 * Handlers:
 * - DeviceStatusUpdater: Sets device status to OFFLINE if not already
 * - AlertService: Triggers critical alerts for ONLINE→OFFLINE transitions
 * - NotificationService: Sends high-priority notifications to on-call teams
 * - IncidentManager: Creates or updates incident ticket for outage tracking
 * - EscalationOrchestrator: Initiates escalation workflows for critical devices
 * - SLATracker: Records downtime and potential SLA violations
 * - RecoveryService: Schedules additional verification polls to confirm outage
 *
 * Use Cases:
 * - Device goes offline due to hardware failure or power loss
 * - Network path to device is broken or unreachable
 * - Device becomes unresponsive due to high load or crash
 * - Firewall or security policy blocks ICMP ping packets
 * - Timeout occurs due to network congestion or routing issues
 *
 * Business Rules:
 * - Event published only after ALL retry attempts have failed
 * - wasOnline flag distinguishes new outages from continued offline state
 * - TIMEOUT status indicates no response within time limit
 * - FAILED status indicates network error or explicit rejection
 * - Critical alerts triggered only when wasOnline=true (new outage)
 * - Continued failures (wasOnline=false) update existing incident
 * - attemptNumber tracks which retry attempt failed (for diagnostics)
 * - errorMessage contains technical failure details for troubleshooting
 *
 * @example
 * ```typescript
 * // Device going offline (critical alert)
 * const event = new DevicePollingFailedEvent({
 *   aggregateId: PollingResultId.create().value,
 *   networkDeviceId: NetworkDeviceId.create().value,
 *   deviceName: 'Core-Router-01',
 *   ipAddress: '192.168.1.1',
 *   status: PollingStatus.create('TIMEOUT').value,
 *   errorMessage: 'Request timeout after 5000ms',
 *   attemptNumber: 3,
 *   wasOnline: true,
 *   dateTimeOccurred: new Date()
 * });
 *
 * // Check if critical outage
 * if (event.isGoingOffline()) {
 *   // Trigger high-priority alert and escalation
 * }
 * ```
 */
export class DevicePollingFailedEvent extends DomainEvent<DevicePollingFailedEventProps> {
  constructor(props: DevicePollingFailedEventProps) {
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

  get status(): PollingStatus {
    return this.props.status;
  }

  get errorMessage(): string {
    return this.props.errorMessage;
  }

  get attemptNumber(): number {
    return this.props.attemptNumber;
  }

  get wasOnline(): boolean {
    return this.props.wasOnline;
  }

  /**
   * Checks if this represents a device going offline (was previously online).
   */
  public isGoingOffline(): boolean {
    return this.props.wasOnline;
  }

  /**
   * Checks if the failure was due to timeout.
   */
  public isTimeout(): boolean {
    return this.props.status.isTimeout();
  }

  /**
   * Checks if the failure was a general failure.
   */
  public isGeneralFailure(): boolean {
    return this.props.status.isFailed();
  }
}
