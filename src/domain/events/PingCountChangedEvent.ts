import {
  IDomainEvent,
  UniqueEntityID,
  PollingConfigurationId,
  NetworkDeviceId
} from '../';

/**
 * PingCountChangedEvent
 *
 * Domain event raised when a device's ping count (number of ICMP pings per poll) is changed.
 * This affects the accuracy of statistical metrics collected during polling.
 *
 * Higher ping counts provide:
 * - Better statistical accuracy
 * - More reliable jitter measurements
 * - Better packet loss detection
 *
 * But also increase:
 * - Polling duration
 * - Network overhead
 *
 * This event triggers:
 * - Configuration history logging
 * - Notifications to administrators
 */
export class PingCountChangedEvent implements IDomainEvent {
  public readonly dateTimeOccurred: Date;

  constructor(
    private readonly aggregateId: PollingConfigurationId,
    public readonly networkDeviceId: NetworkDeviceId,
    public readonly previousPingCount: number,
    public readonly newPingCount: number,
    public readonly deviceName: string
  ) {
    this.dateTimeOccurred = new Date();
  }

  getAggregateId(): UniqueEntityID {
    return this.aggregateId;
  }

  /**
   * Gets the ping count change delta.
   */
  public getPingCountDelta(): number {
    return this.newPingCount - this.previousPingCount;
  }

  /**
   * Checks if the ping count was increased.
   */
  public wasIncreased(): boolean {
    return this.getPingCountDelta() > 0;
  }

  /**
   * Checks if the ping count was decreased.
   */
  public wasDecreased(): boolean {
    return this.getPingCountDelta() < 0;
  }
}
