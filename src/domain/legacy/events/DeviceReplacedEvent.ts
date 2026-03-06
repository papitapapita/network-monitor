import {
  DomainEvent,
  DeviceReplacedEventProps,
  NetworkDeviceId,
  IPAddress,
  MACAddress
} from '../';

/**
 * DeviceReplacedEvent - A new device has been identified as a replacement for a deleted device.
 *
 * Published By: NetworkDevice Aggregate (the NEW replacement device)
 * Published When: A device is created with the same IP address as a recently deleted device,
 *                 and user confirms it's a replacement (not a conflict)
 *
 * Handlers:
 * - PollingService: Migrates polling configuration from old device to new device
 * - MonitoringService: Updates monitoring dashboards with new device ID
 * - HistoricalDataService: Links historical metrics from old device to new device
 * - NotificationService: Notifies administrators of device replacement
 * - AuditLogger: Records replacement event with migration details
 * - ConfigurationService: Migrates custom configurations and settings
 *
 * Use Cases:
 * - Physical hardware replacement - same IP, different MAC (new NIC/device)
 * - Network interface card (NIC) replacement on existing device
 * - Device upgrade - old device decommissioned, new device takes over
 * - MAC address change due to hardware failure and replacement
 *
 * Business Rules:
 * - Old device must be in deleted state
 * - New device must share the same IP address as old device
 * - New device must have a different MAC address than old device
 * - Replacement detection happens when new device is created within 7 days of old device deletion
 * - User must explicitly confirm replacement (auto-detection prompts, doesn't auto-replace)
 * - Configuration migration is optional but recommended
 * - Metadata migration is optional but recommended
 * - Historical data linkage is automatic after confirmation
 *
 * @see REQ-002 Acceptance Criteria AC-002.9
 * @see REQ-002 Functional Requirement FR-002.8 (Device Replacement Workflow)
 *
 * @example
 * ```typescript
 * const event = new DeviceReplacedEvent({
 *   oldDeviceId: NetworkDeviceId.create('uuid-of-old-device').value,
 *   newDeviceId: NetworkDeviceId.create('uuid-of-new-device').value,
 *   ipAddress: IPAddress.create('192.168.1.1').value,
 *   oldMacAddress: MACAddress.create('00:1A:2B:3C:4D:5E').value,
 *   newMacAddress: MACAddress.create('00:1A:2B:3C:4D:5F').value,
 *   configMigrated: true,
 *   metadataMigrated: true,
 *   replacedBy: 'admin-user-789',
 *   dateTimeOccurred: new Date()
 * });
 *
 * // Helper usage
 * console.log(event.getReplacementMessage());
 * // Output: "Device at 192.168.1.1 replaced (00:1A:2B:3C:4D:5E → 00:1A:2B:3C:4D:5F) by admin-user-789"
 *
 * console.log(event.getMigrationSummary());
 * // Output: "Configuration: ✓ Migrated | Metadata: ✓ Migrated"
 * ```
 */
export class DeviceReplacedEvent extends DomainEvent<DeviceReplacedEventProps> {
  constructor(props: DeviceReplacedEventProps) {
    super(props);
  }

  get aggregateId(): NetworkDeviceId {
    // The new device is the aggregate that published this event
    return this.props.newDeviceId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get oldDeviceId(): NetworkDeviceId {
    return this.props.oldDeviceId;
  }

  get newDeviceId(): NetworkDeviceId {
    return this.props.newDeviceId;
  }

  get ipAddress(): IPAddress {
    return this.props.ipAddress;
  }

  get oldMacAddress(): MACAddress {
    return this.props.oldMacAddress;
  }

  get newMacAddress(): MACAddress {
    return this.props.newMacAddress;
  }

  get configMigrated(): boolean {
    return this.props.configMigrated;
  }

  get metadataMigrated(): boolean {
    return this.props.metadataMigrated;
  }

  get replacedBy(): string {
    return this.props.replacedBy;
  }

  /**
   * Helper method to format replacement message for logging
   */
  public getReplacementMessage(): string {
    return `Device at ${this.ipAddress.toString()} replaced (${this.oldMacAddress.toString()} → ${this.newMacAddress.toString()}) by ${this.replacedBy}`;
  }

  /**
   * Helper method to check if any migration occurred
   */
  public wasMigrated(): boolean {
    return this.configMigrated || this.metadataMigrated;
  }

  /**
   * Helper method to get migration summary for logging
   */
  public getMigrationSummary(): string {
    const configStatus = this.configMigrated ? '✓ Migrated' : '✗ Not Migrated';
    const metadataStatus = this.metadataMigrated ? '✓ Migrated' : '✗ Not Migrated';
    return `Configuration: ${configStatus} | Metadata: ${metadataStatus}`;
  }

  /**
   * Helper method to check if full migration occurred (both config and metadata)
   */
  public isFullyMigrated(): boolean {
    return this.configMigrated && this.metadataMigrated;
  }
}
