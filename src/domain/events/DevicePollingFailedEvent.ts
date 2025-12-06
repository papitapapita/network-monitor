import { IDomainEvent } from '../shared/interfaces/IDomainEvent';
import { UniqueEntityID } from '../shared/kernel/UniqueEntityID';
import { NetworkDeviceId } from '../entities/NetworkDeviceId';
import { PollingResultId } from '../entities/PollingResultId';
import { PollingStatus } from '../value-objects';

/**
 * DevicePollingFailedEvent
 *
 * Domain event raised when a network device polling fails after all retries.
 * This indicates a device is unreachable and may be offline.
 *
 * This event triggers:
 * - Status update to OFFLINE
 * - Alerting and notifications
 * - Incident creation
 * - Escalation workflows
 * - SLA violation tracking
 */
export class DevicePollingFailedEvent implements IDomainEvent {
  public readonly dateTimeOccurred: Date;

  constructor(
    private readonly aggregateId: PollingResultId,
    public readonly networkDeviceId: NetworkDeviceId,
    public readonly deviceName: string,
    public readonly ipAddress: string,
    public readonly status: PollingStatus, // FAILED or TIMEOUT
    public readonly errorMessage: string,
    public readonly attemptNumber: number,
    public readonly wasOnline: boolean // True if this is transition from online state
  ) {
    this.dateTimeOccurred = new Date();
  }

  getAggregateId(): UniqueEntityID {
    return this.aggregateId;
  }

  /**
   * Checks if this represents a device going offline (was previously online).
   */
  public isGoingOffline(): boolean {
    return this.wasOnline;
  }

  /**
   * Checks if the failure was due to timeout.
   */
  public isTimeout(): boolean {
    return this.status === PollingStatus.TIMEOUT;
  }

  /**
   * Checks if the failure was a general failure.
   */
  public isGeneralFailure(): boolean {
    return this.status === PollingStatus.FAILED;
  }
}
