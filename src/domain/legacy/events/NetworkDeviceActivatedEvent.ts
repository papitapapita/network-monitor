import {
  DomainEvent,
  NetworkDeviceActivatedEventProps,
  NetworkDeviceId,
  IPAddress,
  MACAddress
} from '../../device-inventory';

/**
 * NetworkDeviceActivatedEvent - A device has transitioned from DRAFT to ACTIVE state.
 *
 * Published By: NetworkDevice Aggregate
 * Published When: A draft device is explicitly activated after all required fields are populated
 *
 * Handlers:
 * - PollingService: Evaluates whether to enable polling based on device type
 * - MonitoringService: Adds device to active monitoring dashboards
 * - NotificationService: Notifies administrators of device activation
 * - AuditLogger: Records activation event for compliance tracking
 * - MetricsCollector: Begins collecting operational metrics for the device
 *
 * Use Cases:
 * - Network administrator completes device configuration after discovery
 * - Bulk import process activates devices after enrichment
 * - Auto-discovery system transitions devices from pending to active status
 * - Device migrated from staging to production environment
 *
 * Business Rules:
 * - Device must be in DRAFT state before activation
 * - Device must have all required fields populated (name, deviceType, deviceId, IP, MAC)
 * - Activation is explicit - never automatic
 * - Event is published only after successful status transition
 * - Activated devices become visible in operational queries and monitoring
 *
 * @see REQ-002 Acceptance Criteria AC-002.2
 * @see REQ-002 Functional Requirement FR-002.1 (Device Lifecycle States)
 *
 * @example
 * ```typescript
 * const event = new NetworkDeviceActivatedEvent({
 *   aggregateId: NetworkDeviceId.create().value,
 *   deviceName: 'Core-Router-01',
 *   ipAddress: IPAddress.create('192.168.1.1').value,
 *   macAddress: MACAddress.create('00:1A:2B:3C:4D:5E').value,
 *   activatedBy: 'user-123',
 *   dateTimeOccurred: new Date()
 * });
 * ```
 */
export class NetworkDeviceActivatedEvent extends DomainEvent<NetworkDeviceActivatedEventProps> {
  constructor(props: NetworkDeviceActivatedEventProps) {
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

  get activatedBy(): string {
    return this.props.activatedBy;
  }

  /**
   * Helper method to format activation message for logging
   */
  public getActivationMessage(): string {
    return `Device '${this.deviceName}' (${this.ipAddress.toString()}) activated by ${this.activatedBy}`;
  }
}
