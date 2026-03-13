import {
  NetworkDeviceUpdatedEventProps,
  DomainEvent,
  NetworkDeviceId
} from '../../device-inventory';

/**
 * NetworkDeviceUpdatedEvent - Network device properties have been modified.
 *
 * Published By: NetworkDevice Aggregate
 * Published When: Non-critical device properties are updated (name, description, location, etc.)
 *
 * Handlers:
 * - AuditLogger: Records field-level changes for compliance and audit trail
 * - NotificationService: Alerts administrators of configuration changes
 * - ExternalSystemSync: Synchronizes changes with CMDBs and other external systems
 * - SearchIndexer: Updates device search index with new values
 *
 * Use Cases:
 * - Admin renames a device for better identification
 * - Device description or location information is updated
 * - Device metadata is corrected or enhanced
 * - Multiple administrative fields are updated simultaneously
 *
 * Business Rules:
 * - Event tracks previous and new values for all changed fields
 * - At least one field must be changed for event to be published
 * - Does NOT include critical state changes (use specific events instead):
 *   - Status changes → NetworkDeviceStatusChangedEvent
 *   - Polling config → PollingIntervalChangedEvent, PingCountChangedEvent
 * - Event is published only after successful validation and persistence
 * - Changed fields list must match keys in previous/new value maps
 *
 * @example
 * ```typescript
 * const event = new NetworkDeviceUpdatedEvent({
 *   aggregateId: NetworkDeviceId.create().value,
 *   deviceName: 'Updated-Router-01',
 *   changedFields: ['name', 'description'],
 *   previousValues: {
 *     name: 'Old-Router',
 *     description: 'Legacy description'
 *   },
 *   newValues: {
 *     name: 'Updated-Router-01',
 *     description: 'Updated core router - Building A'
 *   },
 *   dateTimeOccurred: new Date()
 * });
 * ```
 */
export class NetworkDeviceUpdatedEvent extends DomainEvent<NetworkDeviceUpdatedEventProps> {
  constructor(props: NetworkDeviceUpdatedEventProps) {
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

  get changedFields(): string[] {
    return this.props.changedFields;
  }

  get previousValues(): Record<string, unknown> {
    return this.props.previousValues;
  }

  get newValues(): Record<string, unknown> {
    return this.props.newValues;
  }

  /**
   * Checks if a specific field was changed.
   */
  public hasFieldChanged(fieldName: string): boolean {
    return this.props.changedFields.includes(fieldName);
  }

  /**
   * Gets the previous value of a field.
   */
  public getPreviousValue(fieldName: string): unknown {
    return this.props.previousValues[fieldName];
  }

  /**
   * Gets the new value of a field.
   */
  public getNewValue(fieldName: string): unknown {
    return this.props.newValues[fieldName];
  }
}
