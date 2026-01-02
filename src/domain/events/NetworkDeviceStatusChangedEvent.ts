import {
  NetworkDeviceStatusChangedEventProps,
  DomainEvent,
  NetworkDeviceStatus,
  NetworkDeviceId,
  IPAddress
} from '../';

/**
 * NetworkDeviceStatusChangedEvent - Device operational status has changed.
 *
 * Published By: NetworkDevice Aggregate
 * Published When: Device transitions between operational states (ONLINE ↔ OFFLINE ↔ MAINTENANCE ↔ UNKNOWN)
 *
 * Handlers:
 * - AlertService: Triggers critical alerts for ONLINE→OFFLINE transitions
 * - NotificationService: Sends email/SMS to administrators and on-call teams
 * - StatusHistoryLogger: Records status timeline for SLA reporting
 * - IncidentManager: Creates incidents for unexpected outages
 * - RecoveryOrchestrator: Initiates automated recovery procedures
 * - SLATracker: Updates uptime metrics and compliance calculations
 * - DashboardUpdater: Refreshes real-time status displays
 *
 * Use Cases:
 * - Polling detects device has gone offline (no response to pings)
 * - Device recovers and comes back online after outage
 * - Admin places device in maintenance mode before scheduled work
 * - Device exits maintenance mode after work completion
 * - Device status becomes unknown after repeated polling failures
 *
 * Business Rules:
 * - Status must actually change (previous ≠ new) for event to be published
 * - ONLINE→OFFLINE transitions trigger high-priority alerts
 * - MAINTENANCE transitions suppress alerting but track downtime separately
 * - Status changes update device's lastStatusChange timestamp
 * - Event includes both previous and new status for context
 * - Critical transitions (to OFFLINE) may trigger escalation workflows
 *
 * @example
 * ```typescript
 * const event = new NetworkDeviceStatusChangedEvent({
 *   aggregateId: NetworkDeviceId.create().value,
 *   deviceName: 'Core-Router-01',
 *   previousStatus: NetworkDeviceStatus.create('ONLINE').value,
 *   newStatus: NetworkDeviceStatus.create('OFFLINE').value,
 *   ipAddress: '192.168.1.1',
 *   dateTimeOccurred: new Date()
 * });
 *
 * // Check critical transitions
 * if (event.isGoingOffline()) {
 *   // Trigger high-priority alert
 * }
 * ```
 */
export class NetworkDeviceStatusChangedEvent extends DomainEvent<NetworkDeviceStatusChangedEventProps> {
  constructor(props: NetworkDeviceStatusChangedEventProps) {
    super(props);
  }

  get aggregateId(): NetworkDeviceId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceName(): string {
    return this.props.deviceName;
  }

  get previousStatus(): NetworkDeviceStatus {
    return this.props.previousStatus;
  }

  get newStatus(): NetworkDeviceStatus {
    return this.props.newStatus;
  }

  get ipAddress(): IPAddress {
    return this.props.ipAddress;
  }

  /**
   * Checks if this represents a device going offline.
   */
  public isGoingOffline(): boolean {
    return (
      !this.props.previousStatus.isOffline() &&
      this.props.newStatus.isOffline()
    );
  }

  /**
   * Checks if this represents a device coming back online.
   */
  public isComingOnline(): boolean {
    return (
      !this.props.previousStatus.isOnline() &&
      this.props.newStatus.isOnline()
    );
  }

  /**
   * Checks if this represents a device entering maintenance.
   */
  public isEnteringMaintenance(): boolean {
    return (
      !this.props.previousStatus.isMaintenance() &&
      this.props.newStatus.isMaintenance()
    );
  }

  /**
   * Checks if this represents a device leaving maintenance.
   */
  public isLeavingMaintenance(): boolean {
    return (
      this.props.previousStatus.isMaintenance() &&
      !this.props.newStatus.isMaintenance()
    );
  }
}
