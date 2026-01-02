import {
  DomainEvent,
  NetworkDeviceCreatedEventProps,
  NetworkDeviceId,
  IPAddress,
  MACAddress
} from '../';

/**
 * NetworkDeviceCreatedEvent - A new network device has been registered in the system.
 *
 * Published By: NetworkDevice Aggregate
 * Published When: A new network device is successfully created with valid name, IP address, and MAC address
 *
 * Handlers:
 * - PollingConfigurationService: Creates default polling configuration for the device
 * - NotificationService: Notifies administrators of new device registration
 * - AuditLogger: Records device creation for compliance and tracking
 * - MetricsCollector: Initializes metrics tracking for the device
 *
 * Use Cases:
 * - Admin registers a new router, switch, or access point to be monitored
 * - Auto-discovery system detects and registers new network devices
 * - Device is migrated from another monitoring system
 *
 * Business Rules:
 * - Device must have unique IP address in the system
 * - Device must have unique MAC address in the system
 * - Device name must be non-empty and follow naming conventions
 * - Event is published only after device passes all validation rules
 * - Event represents successful persistence of device to the database
 *
 * @example
 * ```typescript
 * const event = new NetworkDeviceCreatedEvent({
 *   aggregateId: NetworkDeviceId.create().value,
 *   deviceName: 'Core-Router-01',
 *   ipAddress: '192.168.1.1',
 *   macAddress: '00:1A:2B:3C:4D:5E',
 *   dateTimeOccurred: new Date()
 * });
 * ```
 */
export class NetworkDeviceCreatedEvent extends DomainEvent<NetworkDeviceCreatedEventProps> {
  constructor(props: NetworkDeviceCreatedEventProps) {
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
}
