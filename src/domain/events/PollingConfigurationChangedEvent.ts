import { IDomainEvent } from '../shared/interfaces/IDomainEvent';
import { UniqueEntityID } from '../shared/kernel/UniqueEntityID';
import { PollingConfigurationId } from '../entities/PollingConfigurationId';
import { NetworkDeviceId } from '../entities/NetworkDeviceId';

/**
 * PollingConfigurationChangedEvent
 *
 * Domain event raised when any aspect of a device's polling configuration changes.
 * This is a general event for configuration changes that don't have specific events.
 *
 * Specific changes like interval and ping count have their own events:
 * - PollingIntervalChangedEvent
 * - PingCountChangedEvent
 *
 * This event is for changes like:
 * - Retry policy updates
 * - Enabled/disabled state changes
 * - Other configuration modifications
 *
 * This event triggers:
 * - Configuration history logging
 * - Audit trail updates
 * - Cache invalidation
 */
export class PollingConfigurationChangedEvent implements IDomainEvent {
  public readonly dateTimeOccurred: Date;

  constructor(
    private readonly aggregateId: PollingConfigurationId,
    public readonly networkDeviceId: NetworkDeviceId,
    public readonly deviceName: string,
    public readonly changeDescription: string
  ) {
    this.dateTimeOccurred = new Date();
  }

  getAggregateId(): UniqueEntityID {
    return this.aggregateId;
  }
}
