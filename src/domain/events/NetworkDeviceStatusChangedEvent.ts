import {
  IDomainEvent,
  UniqueEntityID,
  NetworkDeviceId,
  NetworkDeviceStatus
} from '../';

/**
 * NetworkDeviceStatusChangedEvent
 *
 * Domain event raised when a network device's status changes
 * (e.g., ONLINE → OFFLINE, OFFLINE → ONLINE, etc.).
 *
 * This is a critical event that triggers:
 * - Alerting and notifications
 * - Status history logging
 * - Automated recovery procedures
 * - SLA compliance tracking
 */
export class NetworkDeviceStatusChangedEvent implements IDomainEvent {
  public readonly dateTimeOccurred: Date;

  constructor(
    private readonly aggregateId: NetworkDeviceId,
    public readonly deviceName: string,
    public readonly previousStatus: NetworkDeviceStatus,
    public readonly newStatus: NetworkDeviceStatus,
    public readonly ipAddress: string
  ) {
    this.dateTimeOccurred = new Date();
  }

  getAggregateId(): UniqueEntityID {
    return this.aggregateId;
  }

  /**
   * Checks if this represents a device going offline.
   */
  public isGoingOffline(): boolean {
    return (
      this.previousStatus !== NetworkDeviceStatus.OFFLINE &&
      this.newStatus === NetworkDeviceStatus.OFFLINE
    );
  }

  /**
   * Checks if this represents a device coming back online.
   */
  public isComingOnline(): boolean {
    return (
      this.previousStatus !== NetworkDeviceStatus.ONLINE &&
      this.newStatus === NetworkDeviceStatus.ONLINE
    );
  }

  /**
   * Checks if this represents a device entering maintenance.
   */
  public isEnteringMaintenance(): boolean {
    return (
      this.previousStatus !== NetworkDeviceStatus.MAINTENANCE &&
      this.newStatus === NetworkDeviceStatus.MAINTENANCE
    );
  }

  /**
   * Checks if this represents a device leaving maintenance.
   */
  public isLeavingMaintenance(): boolean {
    return (
      this.previousStatus === NetworkDeviceStatus.MAINTENANCE &&
      this.newStatus !== NetworkDeviceStatus.MAINTENANCE
    );
  }
}
