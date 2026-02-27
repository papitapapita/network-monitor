import {
  DomainEvent,
  NetworkDeviceRestoredEventProps,
  NetworkDeviceId,
  IPAddress
} from '..';

/**
 * NetworkDeviceRestoredEvent - A soft-deleted device has been restored within the grace period.
 *
 * Published By: NetworkDevice Aggregate
 * Published When: A deleted device is explicitly restored before permanent deletion (within 7 days)
 *
 * Handlers:
 * - PollingService: Re-enables polling if it was previously enabled
 * - MonitoringService: Re-adds device to active monitoring dashboards
 * - NotificationService: Notifies administrators of device restoration
 * - AuditLogger: Records restoration event with original deletion context
 * - MetricsCollector: Resumes collecting operational metrics for the device
 *
 * Use Cases:
 * - Accidental deletion recovery - administrator mistakenly deleted a device
 * - Change of plans - deletion was queued but decision reversed
 * - Testing rollback - device deleted during testing, now being restored
 * - Bulk operation undo - restore devices after erroneous bulk delete
 *
 * Business Rules:
 * - Device must be in soft-deleted state (deletedAt !== null)
 * - Restoration must occur within 7-day grace period
 * - Device returns to its exact state before deletion (same activation status, config, etc.)
 * - All associations and configurations are preserved
 * - Restoration is explicit - never automatic
 * - Event includes original deletedAt timestamp for audit trail
 *
 * @see REQ-002 Acceptance Criteria AC-002.7
 * @see REQ-002 Functional Requirement FR-002.5 (Soft Delete with Grace Period)
 *
 * @example
 * ```typescript
 * const event = new NetworkDeviceRestoredEvent({
 *   aggregateId: NetworkDeviceId.create().value,
 *   deviceName: 'Core-Router-01',
 *   ipAddress: IPAddress.create('192.168.1.1').value,
 *   restoredBy: 'admin-user-456',
 *   deletedAt: new Date('2024-01-01T10:00:00Z'), // Original deletion time
 *   dateTimeOccurred: new Date() // Restoration time
 * });
 *
 * // Helper usage
 * console.log(event.getRestorationMessage());
 * // Output: "Device 'Core-Router-01' (192.168.1.1) restored by admin-user-456 after 3 days"
 * ```
 */
export class NetworkDeviceRestoredEvent extends DomainEvent<NetworkDeviceRestoredEventProps> {
  constructor(props: NetworkDeviceRestoredEventProps) {
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

  get ipAddress(): IPAddress {
    return this.props.ipAddress;
  }

  get restoredBy(): string {
    return this.props.restoredBy;
  }

  get deletedAt(): Date {
    return this.props.deletedAt;
  }

  /**
   * Helper method to format restoration message for logging
   */
  public getRestorationMessage(): string {
    const daysDeleted = this.getDaysDeleted();
    return `Device '${this.deviceName}' (${this.ipAddress.toString()}) restored by ${this.restoredBy} after ${daysDeleted} days`;
  }

  /**
   * Helper method to calculate how many days the device was in deleted state
   */
  public getDaysDeleted(): number {
    const millisecondsDiff =
      this.dateTimeOccurred.getTime() - this.deletedAt.getTime();
    const daysDiff = millisecondsDiff / (1000 * 60 * 60 * 24);
    return Math.floor(daysDiff);
  }

  /**
   * Helper method to check if restoration was within grace period (7 days)
   */
  public isWithinGracePeriod(): boolean {
    return this.getDaysDeleted() <= 7;
  }
}
