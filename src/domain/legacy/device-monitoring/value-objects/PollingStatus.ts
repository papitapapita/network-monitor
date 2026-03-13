import { ValueObject, Result, Guard } from 'domain/shared/core';
import { PollingStatusProps } from '../props';

/**
 * PollingStatus Value Object
 *
 * Represents the outcome status of a single polling operation.
 * This is distinct from NetworkDeviceStatus, which represents the overall device state.
 *
 * A poll can succeed, fail, timeout, or have partial success (relevant for multi-ping scenarios).
 *
 * Business Rules:
 * - Status must be one of the predefined valid statuses
 * - Status cannot be null or empty
 * - SUCCESS means all pings received responses
 * - FAILED means device is unreachable (all pings failed)
 * - TIMEOUT means no response within configured timeout period
 * - PARTIAL_SUCCESS means some pings succeeded, some failed (indicates potential network instability)
 *
 * @example
 * const statusResult = PollingStatus.createSuccess();
 * if (statusResult.isSuccess) {
 *   const status = statusResult.value;
 *   console.log(status.getDisplayName()); // 'Success'
 *   console.log(status.isDeviceReachable()); // true
 * }
 *
 * @example
 * const statusResult = PollingStatus.calculateFromPingResults(3, 5);
 * // Returns PARTIAL_SUCCESS since 3 out of 5 pings succeeded
 */

export class PollingStatus extends ValueObject<PollingStatusProps> {
  /**
   * Status constants for type-safe status values
   */
  public static readonly SUCCESS = 'SUCCESS';
  public static readonly FAILED = 'FAILED';
  public static readonly TIMEOUT = 'TIMEOUT';
  public static readonly PARTIAL_SUCCESS = 'PARTIAL_SUCCESS';

  /**
   * Valid status values
   */
  private static readonly VALID_STATUSES = [
    PollingStatus.SUCCESS,
    PollingStatus.FAILED,
    PollingStatus.TIMEOUT,
    PollingStatus.PARTIAL_SUCCESS
  ] as const;

  get value(): string {
    return this._props.value;
  }

  private constructor(_props: PollingStatusProps) {
    super(_props);
  }

  /**
   * Creates a PollingStatus from a string value.
   *
   * @param status - Status string (SUCCESS, FAILED, TIMEOUT, PARTIAL_SUCCESS)
   * @returns Result containing PollingStatus or error message
   */
  public static create(status: string): Result<PollingStatus> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(status, 'polling status'),
      Guard.isString(status, 'polling status')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<PollingStatus>(guardResult.message!);
    }

    const trimmedStatus = status.trim().toUpperCase();

    if (trimmedStatus.length === 0) {
      return Result.fail<PollingStatus>(
        'Polling status cannot be empty'
      );
    }

    if (!this.isValid(trimmedStatus)) {
      return Result.fail<PollingStatus>(
        `Invalid polling status: ${status}. Must be one of: ${this.VALID_STATUSES.join(', ')}`
      );
    }

    return Result.ok<PollingStatus>(
      new PollingStatus({ value: trimmedStatus })
    );
  }

  /**
   * Factory method to create a SUCCESS status.
   */
  public static createSuccess(): PollingStatus {
    return new PollingStatus({ value: this.SUCCESS });
  }

  /**
   * Factory method to create a FAILED status.
   */
  public static createFailed(): PollingStatus {
    return new PollingStatus({ value: this.FAILED });
  }

  /**
   * Factory method to create a TIMEOUT status.
   */
  public static createTimeout(): PollingStatus {
    return new PollingStatus({ value: this.TIMEOUT });
  }

  /**
   * Factory method to create a PARTIAL_SUCCESS status.
   */
  public static createPartialSuccess(): PollingStatus {
    return new PollingStatus({ value: this.PARTIAL_SUCCESS });
  }

  /**
   * Calculates polling status from multi-ping results.
   *
   * Business Rules:
   * - If no pings succeeded (successfulPings === 0), status is FAILED
   * - If all pings succeeded (successfulPings === totalPings), status is SUCCESS
   * - If some pings succeeded but not all, status is PARTIAL_SUCCESS
   *
   * @param successfulPings - Number of successful pings
   * @param totalPings - Total number of pings attempted
   * @returns Result containing appropriate PollingStatus
   */
  public static calculateFromPingResults(
    successfulPings: number,
    totalPings: number
  ): Result<PollingStatus> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(
        successfulPings,
        'successful pings'
      ),
      Guard.againstNullOrUndefined(totalPings, 'total pings'),
      Guard.isNumber(successfulPings, 'successful pings'),
      Guard.isNumber(totalPings, 'total pings')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<PollingStatus>(guardResult.message!);
    }

    if (successfulPings < 0) {
      return Result.fail<PollingStatus>(
        'Successful pings cannot be negative'
      );
    }

    if (totalPings <= 0) {
      return Result.fail<PollingStatus>(
        'Total pings must be greater than zero'
      );
    }

    if (successfulPings > totalPings) {
      return Result.fail<PollingStatus>(
        'Successful pings cannot exceed total pings'
      );
    }

    if (successfulPings === 0) {
      return Result.ok(this.createFailed());
    }

    if (successfulPings === totalPings) {
      return Result.ok(this.createSuccess());
    }

    return Result.ok(this.createPartialSuccess());
  }

  /**
   * Validates if a string is a valid PollingStatus.
   */
  private static isValid(value: string): boolean {
    return this.VALID_STATUSES.includes(value as any);
  }

  /**
   * Checks if this status is SUCCESS.
   */
  public isSuccess(): boolean {
    return this._props.value === PollingStatus.SUCCESS;
  }

  /**
   * Checks if this status is FAILED.
   */
  public isFailed(): boolean {
    return this._props.value === PollingStatus.FAILED;
  }

  /**
   * Checks if this status is TIMEOUT.
   */
  public isTimeout(): boolean {
    return this._props.value === PollingStatus.TIMEOUT;
  }

  /**
   * Checks if this status is PARTIAL_SUCCESS.
   */
  public isPartialSuccess(): boolean {
    return this._props.value === PollingStatus.PARTIAL_SUCCESS;
  }

  /**
   * Determines if a polling status indicates the device is reachable.
   *
   * A device is considered reachable if it responded to at least some pings,
   * which means the status is either SUCCESS or PARTIAL_SUCCESS.
   *
   * @returns True if device responded (SUCCESS or PARTIAL_SUCCESS)
   */
  public isDeviceReachable(): boolean {
    return (
      this._props.value === PollingStatus.SUCCESS ||
      this._props.value === PollingStatus.PARTIAL_SUCCESS
    );
  }

  /**
   * Gets a user-friendly display name for this status.
   *
   * @returns Human-readable name
   */
  public getDisplayName(): string {
    switch (this._props.value) {
      case PollingStatus.SUCCESS:
        return 'Success';
      case PollingStatus.FAILED:
        return 'Failed';
      case PollingStatus.TIMEOUT:
        return 'Timeout';
      case PollingStatus.PARTIAL_SUCCESS:
        return 'Partial Success';
      default:
        return 'Unknown';
    }
  }

  /**
   * Gets a color code for UI representation of this status.
   *
   * @returns Color code (for CSS or UI frameworks)
   */
  public getColor(): string {
    switch (this._props.value) {
      case PollingStatus.SUCCESS:
        return 'green';
      case PollingStatus.FAILED:
        return 'red';
      case PollingStatus.TIMEOUT:
        return 'orange';
      case PollingStatus.PARTIAL_SUCCESS:
        return 'yellow';
      default:
        return 'gray';
    }
  }

  /**
   * Returns the string representation of the status.
   */
  public toString(): string {
    return this._props.value;
  }

  // equals() inherited from ValueObject base class
}
