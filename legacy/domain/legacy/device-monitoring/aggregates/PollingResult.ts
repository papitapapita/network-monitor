import { AggregateRoot } from 'domain/shared';
import { PollingResultProps } from '../props/PollingResultProps';
import { PollingResultId } from 'domain/legacy/device-monitoring/ids/PollingResultId';
/**
 * PollingResult Aggregate Root
 *
 * Immutable aggregate that captures the outcome of a single polling operation.
 * Each poll creates a new PollingResult that is persisted to TimescaleDB
 * for time-series analysis.
 *
 * Key characteristics:
 * - Immutable after creation (event sourcing pattern)
 * - Contains multi-ping statistics via PollingMetrics
 * - Tracks device status transitions
 * - Supports retry logic
 */

export class PollingResult extends AggregateRoot<
  PollingResultProps,
  PollingResultId
> {
  public static readonly MIN_ATTEMPT_NUMBER = 1;
  public static readonly MAX_ATTEMPT_NUMBER = 10;

  private constructor(
    props: PollingResultProps,
    id: PollingResultId
  ) {
    super(props, id);
  }

  get networkDeviceId(): NetworkDeviceId {
    return this.props.networkDeviceId;
  }

  get timestamp(): Date {
    return this.props.timestamp;
  }

  get status(): PollingStatus {
    return this.props.status;
  }

  get metrics(): PollingMetrics | null {
    return this.props.metrics;
  }

  get attemptNumber(): number {
    return this.props.attemptNumber;
  }

  get errorMessage(): string | null {
    return this.props.errorMessage;
  }

  get deviceStatus(): NetworkDeviceStatus {
    return this.props.deviceStatus;
  }

  /**
   * Reconstitutes a PollingResult aggregate from persistence.
   *
   * This method is used to rebuild PollingResult instances from the database
   * without emitting domain events. For creating new polling results, use
   * createSuccess() or createFailure() factory methods instead.
   *
   * @param props - Polling result properties
   * @param id - Required ID (must be provided, typically from database)
   * @returns Result containing PollingResult or error message
   */
  public static reconstitute(
    props: PollingResultProps,
    id: PollingResultId
  ): Result<PollingResult> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefinedBulk([
        {
          argument: props.networkDeviceId,
          argumentName: 'networkDeviceId'
        },
        { argument: props.timestamp, argumentName: 'timestamp' },
        { argument: props.status, argumentName: 'status' },
        {
          argument: props.deviceStatus,
          argumentName: 'deviceStatus'
        },
        {
          argument: props.attemptNumber,
          argumentName: 'attemptNumber'
        },
        { argument: id, argumentName: 'pollingResultId' }
      ]),
      Guard.isNumber(props.attemptNumber, 'attemptNumber'),
      Guard.inRange(
        props.attemptNumber,
        this.MIN_ATTEMPT_NUMBER,
        this.MAX_ATTEMPT_NUMBER,
        'attemptNumber'
      )
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<PollingResult>(guardResult.message!);
    }

    // Business rule: If status is SUCCESS or PARTIAL_SUCCESS, metrics must be present
    if (
      (props.status.isSuccess() || props.status.isPartialSuccess()) &&
      !props.metrics
    ) {
      return Result.fail<PollingResult>(
        'PollingResult with SUCCESS or PARTIAL_SUCCESS status must have metrics'
      );
    }

    // Business rule: If status is FAILED or TIMEOUT, errorMessage should be present
    if (
      (props.status.isFailed() || props.status.isTimeout()) &&
      !props.errorMessage
    ) {
      return Result.fail<PollingResult>(
        'PollingResult with FAILED or TIMEOUT status must have errorMessage'
      );
    }

    const pollingResult = new PollingResult(
      {
        ...props,
        attemptNumber: Math.round(props.attemptNumber)
      },
      id
    );

    return Result.ok<PollingResult>(pollingResult);
  }

  /**
   * Creates a successful PollingResult with metrics.
   *
   * @param props - Required properties for successful poll
   * @returns Result containing PollingResult
   */
  public static createSuccess(props: {
    networkDeviceId: NetworkDeviceId;
    timestamp: Date;
    metrics: PollingMetrics;
    attemptNumber: number;
    deviceStatus: NetworkDeviceStatus;
    deviceName: string;
    ipAddress: IPAddress;
    wasOffline?: boolean;
  }): Result<PollingResult> {
    // Generate ID for new polling result
    const id = PollingResultId.create().value;

    const createResult = this.reconstitute(
      {
        networkDeviceId: props.networkDeviceId,
        timestamp: props.timestamp,
        status: PollingStatus.createSuccess(),
        metrics: props.metrics,
        attemptNumber: props.attemptNumber,
        errorMessage: null,
        deviceStatus: props.deviceStatus
      },
      id
    );

    if (createResult.isSuccess) {
      const pollingResult = createResult.value;

      // Emit success event
      pollingResult.addDomainEvent(
        new DevicePolledSuccessfullyEvent({
          aggregateId: pollingResult.id,
          networkDeviceId: props.networkDeviceId,
          deviceName: props.deviceName,
          ipAddress: props.ipAddress,
          metrics: props.metrics,
          wasOffline: props.wasOffline || false,
          dateTimeOccurred: new Date()
        })
      );
    }

    return createResult;
  }

  /**
   * Creates a failed PollingResult with error message.
   *
   * @param props - Required properties for failed poll
   * @returns Result containing PollingResult
   */
  public static createFailure(props: {
    networkDeviceId: NetworkDeviceId;
    timestamp: Date;
    status: PollingStatus; // FAILED or TIMEOUT
    errorMessage: string;
    attemptNumber: number;
    deviceStatus: NetworkDeviceStatus;
    deviceName: string;
    ipAddress: IPAddress;
    wasOnline?: boolean;
    metrics?: PollingMetrics | null;
  }): Result<PollingResult> {
    // Generate ID for new polling result
    const id = PollingResultId.create().value;

    const createResult = this.reconstitute(
      {
        networkDeviceId: props.networkDeviceId,
        timestamp: props.timestamp,
        status: props.status,
        metrics: props.metrics || null,
        attemptNumber: props.attemptNumber,
        errorMessage: props.errorMessage,
        deviceStatus: props.deviceStatus
      },
      id
    );

    if (createResult.isSuccess) {
      const pollingResult = createResult.value;

      // Emit failure event
      pollingResult.addDomainEvent(
        new DevicePollingFailedEvent({
          aggregateId: pollingResult.id,
          networkDeviceId: props.networkDeviceId,
          deviceName: props.deviceName,
          ipAddress: props.ipAddress,
          status: props.status,
          errorMessage: props.errorMessage,
          attemptNumber: props.attemptNumber,
          wasOnline: props.wasOnline || false,
          dateTimeOccurred: new Date()
        })
      );
    }

    return createResult;
  }

  /**
   * Checks if this poll was successful.
   */
  public isSuccessful(): boolean {
    return (
      this.props.status.isSuccess() ||
      this.props.status.isPartialSuccess()
    );
  }

  /**
   * Checks if this poll failed.
   */
  public hasFailed(): boolean {
    return (
      this.props.status.isFailed() || this.props.status.isTimeout()
    );
  }

  /**
   * Determines if another retry should be attempted based on the retry policy.
   *
   * @param retryPolicy - The retry policy to check against
   * @returns True if should retry, false otherwise
   */
  public shouldRetry(retryPolicy: RetryPolicy): boolean {
    if (this.isSuccessful()) {
      return false; // Don't retry successful polls
    }

    return retryPolicy.shouldRetry(this.props.attemptNumber);
  }

  /**
   * Checks if this poll indicates the device is online.
   */
  public indicatesOnline(): boolean {
    return this.props.deviceStatus.isOnline();
  }

  /**
   * Checks if this poll indicates the device is offline.
   */
  public indicatesOffline(): boolean {
    return this.props.deviceStatus.isOffline();
  }

  /**
   * Gets a human-readable summary of the result.
   */
  public toDisplayString(): string {
    if (this.isSuccessful()) {
      const avgTime =
        this.props.metrics?.averageResponseTime?.toFixed(2) || 'N/A';
      return `${this.props.status} - ${avgTime}ms avg (attempt ${this.props.attemptNumber})`;
    } else {
      return `${this.props.status} - ${this.props.errorMessage} (attempt ${this.props.attemptNumber})`;
    }
  }

  /**
   * Returns a compact summary for logging.
   */
  public toString(): string {
    return `PollingResult[${this.props.status}] for device ${this.props.networkDeviceId.toString()} at ${this.props.timestamp.toISOString()}`;
  }
}
