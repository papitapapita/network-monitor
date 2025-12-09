import { IDomainEvent, UniqueEntityID, NetworkDeviceId } from '../';

/**
 * NetworkDeviceCreatedEvent
 *
 * Domain event raised when a new network device is created in the system.
 * This event allows other parts of the system to react to new devices,
 * such as:
 * - Starting polling for the device
 * - Creating initial monitoring configurations
 * - Sending notifications to administrators
 */
export class NetworkDeviceCreatedEvent implements IDomainEvent {
  public readonly dateTimeOccurred: Date;

  constructor(
    private readonly aggregateId: NetworkDeviceId,
    public readonly deviceName: string,
    public readonly ipAddress: string,
    public readonly macAddress: string
  ) {
    this.dateTimeOccurred = new Date();
  }

  getAggregateId(): UniqueEntityID {
    return this.aggregateId;
  }
}
