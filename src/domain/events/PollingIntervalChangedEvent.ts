import { IDomainEvent } from '../shared/interfaces/IDomainEvent';
import { UniqueEntityID } from '../shared/kernel/UniqueEntityID';
import { PollingConfigurationId } from '../entities/PollingConfigurationId';
import { NetworkDeviceId } from '../entities/NetworkDeviceId';
import { PollingInterval } from '../value-objects';

/**
 * PollingIntervalChangedEvent
 *
 * Domain event raised when a device's polling interval is changed.
 * This requires rescheduling the polling job.
 *
 * This event triggers:
 * - Polling job rescheduling
 * - Configuration history logging
 * - Notifications to administrators
 */
export class PollingIntervalChangedEvent implements IDomainEvent {
  public readonly dateTimeOccurred: Date;

  constructor(
    private readonly aggregateId: PollingConfigurationId,
    public readonly networkDeviceId: NetworkDeviceId,
    public readonly previousInterval: PollingInterval,
    public readonly newInterval: PollingInterval,
    public readonly deviceName: string
  ) {
    this.dateTimeOccurred = new Date();
  }

  getAggregateId(): UniqueEntityID {
    return this.aggregateId;
  }

  /**
   * Gets the interval change in seconds.
   */
  public getIntervalChangeDelta(): number {
    return this.newInterval.seconds - this.previousInterval.seconds;
  }

  /**
   * Checks if the interval was increased.
   */
  public wasIncreased(): boolean {
    return this.getIntervalChangeDelta() > 0;
  }

  /**
   * Checks if the interval was decreased.
   */
  public wasDecreased(): boolean {
    return this.getIntervalChangeDelta() < 0;
  }
}
