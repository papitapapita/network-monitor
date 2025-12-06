import { IDomainEvent } from '../shared/interfaces/IDomainEvent';
import { UniqueEntityID } from '../shared/kernel/UniqueEntityID';
import { NetworkDeviceId } from '../entities/NetworkDeviceId';
import { PollingResultId } from '../entities/PollingResultId';
import { PollingMetrics } from '../value-objects';

/**
 * DevicePolledSuccessfullyEvent
 *
 * Domain event raised when a network device is successfully polled.
 * This is especially important when it's the first successful poll
 * after a period of failures (device coming back online).
 *
 * This event triggers:
 * - Status update to ONLINE
 * - Notifications (if recovering from outage)
 * - Metrics storage in TimescaleDB
 * - SLA tracking updates
 */
export class DevicePolledSuccessfullyEvent implements IDomainEvent {
  public readonly dateTimeOccurred: Date;

  constructor(
    private readonly aggregateId: PollingResultId,
    public readonly networkDeviceId: NetworkDeviceId,
    public readonly deviceName: string,
    public readonly ipAddress: string,
    public readonly metrics: PollingMetrics,
    public readonly wasOffline: boolean // True if this is recovery from offline state
  ) {
    this.dateTimeOccurred = new Date();
  }

  getAggregateId(): UniqueEntityID {
    return this.aggregateId;
  }

  /**
   * Checks if this represents a device recovery (coming back online).
   */
  public isRecovery(): boolean {
    return this.wasOffline;
  }
}
