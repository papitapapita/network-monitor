import {
  NetworkDeviceDeletedEventProps,
  DomainEvent,
  NetworkDeviceId,
  IPAddress,
  MACAddress
} from '../../device-inventory';

/**
 * NetworkDeviceDeletedEvent - A network device has been permanently removed from the system.
 *
 * Published By: NetworkDevice Aggregate
 * Published When: A device is marked for deletion before permanent removal from the database
 *
 * Handlers:
 * - PollingService: Stops all polling operations for the device
 * - AlertService: Removes device from active alerting and monitoring
 * - AuditLogger: Records deletion event with device details for compliance
 * - ExternalSystemSync: Notifies CMDBs and external inventory systems
 * - DashboardService: Removes device from monitoring dashboards
 * - CleanupService: Removes associated metrics, logs, and historical data
 *
 * Use Cases:
 * - Admin decommissions obsolete or replaced network equipment
 * - Device is permanently removed from network infrastructure
 * - Cleanup of test devices or duplicate entries
 * - Automated removal of devices offline beyond retention policy
 *
 * Business Rules:
 * - Event must be published BEFORE physical deletion to capture device context
 * - All device identification data (name, IP, MAC) is included for audit trail
 * - Optional deletedBy field tracks who initiated the deletion (user or system)
 * - After deletion, all associated data (polling history, metrics) is CASCADE deleted
 * - Event represents irreversible action - device cannot be recovered
 * - Deletion must be authorized (proper permissions required)
 *
 * @example
 * ```typescript
 * const event = new NetworkDeviceDeletedEvent({
 *   aggregateId: NetworkDeviceId.create().value,
 *   deviceName: 'Decommissioned-Router-01',
 *   ipAddress: '192.168.1.1',
 *   macAddress: '00:1A:2B:3C:4D:5E',
 *   deletedBy: 'admin@company.com',
 *   dateTimeOccurred: new Date()
 * });
 * ```
 */
export class NetworkDeviceDeletedEvent extends DomainEvent<NetworkDeviceDeletedEventProps> {
  constructor(props: NetworkDeviceDeletedEventProps) {
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

  get macAddress(): MACAddress {
    return this.props.macAddress;
  }

  get deletedBy(): string | undefined {
    return this.props.deletedBy;
  }
}
