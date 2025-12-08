import { AggregateRoot, Result, Guard } from '../shared/kernel';
import {
  PollingStatus,
  PollingMetrics,
  NetworkDeviceStatus,
  RetryPolicy
} from '../value-objects';
import { PollingResultId, NetworkDeviceId } from './';
import { PollingResultProps } from '../shared/props';

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
   * Creates a new PollingResult aggregate.
   *
   * @param props - Polling result properties
   * @param id - Optional ID (for reconstitution from database)
   * @returns Result containing PollingResult or error message
   */
  public static create(
    props: PollingResultProps,
    id?: PollingResultId
  ): Result<PollingResult> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(
        props.networkDeviceId,
        'networkDeviceId'
      ),
      Guard.againstNullOrUndefined(props.timestamp, 'timestamp'),
      Guard.againstNullOrUndefined(props.status, 'status'),
      Guard.againstNullOrUndefined(
        props.deviceStatus,
        'deviceStatus'
      ),
      Guard.againstNullOrUndefined(
        props.attemptNumber,
        'attemptNumber'
      ),
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
      (props.status === PollingStatus.SUCCESS ||
        props.status === PollingStatus.PARTIAL_SUCCESS) &&
      !props.metrics
    ) {
      return Result.fail<PollingResult>(
        'PollingResult with SUCCESS or PARTIAL_SUCCESS status must have metrics'
      );
    }

    // Business rule: If status is FAILED or TIMEOUT, errorMessage should be present
    if (
      (props.status === PollingStatus.FAILED ||
        props.status === PollingStatus.TIMEOUT) &&
      !props.errorMessage
    ) {
      return Result.fail<PollingResult>(
        'PollingResult with FAILED or TIMEOUT status must have errorMessage'
      );
    }

    const pollingresultId = id || PollingResultId.create().value;

    const pollingResult = new PollingResult(
      {
        ...props,
        attemptNumber: Math.round(props.attemptNumber)
      },
      pollingresultId
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
  }): Result<PollingResult> {
    return this.create({
      networkDeviceId: props.networkDeviceId,
      timestamp: props.timestamp,
      status: PollingStatus.SUCCESS,
      metrics: props.metrics,
      attemptNumber: props.attemptNumber,
      errorMessage: null,
      deviceStatus: props.deviceStatus
    });
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
    metrics?: PollingMetrics | null;
  }): Result<PollingResult> {
    return this.create({
      networkDeviceId: props.networkDeviceId,
      timestamp: props.timestamp,
      status: props.status,
      metrics: props.metrics || null,
      attemptNumber: props.attemptNumber,
      errorMessage: props.errorMessage,
      deviceStatus: props.deviceStatus
    });
  }

  /**
   * Checks if this poll was successful.
   */
  public isSuccessful(): boolean {
    return (
      this.props.status === PollingStatus.SUCCESS ||
      this.props.status === PollingStatus.PARTIAL_SUCCESS
    );
  }

  /**
   * Checks if this poll failed.
   */
  public hasFailed(): boolean {
    return (
      this.props.status === PollingStatus.FAILED ||
      this.props.status === PollingStatus.TIMEOUT
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
    return this.props.deviceStatus === NetworkDeviceStatus.ONLINE;
  }

  /**
   * Checks if this poll indicates the device is offline.
   */
  public indicatesOffline(): boolean {
    return this.props.deviceStatus === NetworkDeviceStatus.OFFLINE;
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
