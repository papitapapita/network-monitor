import { IDomainEvent, NetworkDeviceId } from '../';

/**
 * NetworkDeviceUpdatedEvent
 *
 * Emitted when a network device's properties are updated.
 *
 * This is a generic update event for administrative/metadata changes:
 * - Device name changed
 * - Description changed
 * - Management configuration changed
 *
 * Note: Critical state changes have their own specific events:
 * - Status changes → NetworkDeviceStatusChangedEvent
 * - Polling config → PollingIntervalChangedEvent, etc.
 *
 * Use this event for:
 * - Audit trail of configuration changes
 * - Synchronization with external systems
 * - Notification of non-critical updates
 *
 * @example
 * // In updateName() method:
 * this.addDomainEvent(
 *   new NetworkDeviceUpdatedEvent(
 *     this.id,
 *     this.name,
 *     ['name'],
 *     { name: oldName },
 *     { name: newName }
 *   )
 * );
 */
export class NetworkDeviceUpdatedEvent implements IDomainEvent {
  public readonly dateTimeOccurred: Date;

  constructor(
    public readonly aggregateId: NetworkDeviceId,
    public readonly deviceName: string,
    public readonly changedFields: string[],
    public readonly previousValues: Record<string, any>,
    public readonly newValues: Record<string, any>
  ) {
    this.dateTimeOccurred = new Date();
  }

  public getAggregateId(): NetworkDeviceId {
    return this.aggregateId;
  }

  /**
   * Checks if a specific field was changed.
   */
  public hasFieldChanged(fieldName: string): boolean {
    return this.changedFields.includes(fieldName);
  }

  /**
   * Gets the previous value of a field.
   */
  public getPreviousValue(fieldName: string): any {
    return this.previousValues[fieldName];
  }

  /**
   * Gets the new value of a field.
   */
  public getNewValue(fieldName: string): any {
    return this.newValues[fieldName];
  }
}
