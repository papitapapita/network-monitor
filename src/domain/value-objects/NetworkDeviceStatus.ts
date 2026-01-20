import {
  ValueObject,
  Result,
  Guard,
  NetworkDeviceStatusProps
} from '../';

/**
 * NetworkDeviceStatus Value Object
 *
 * Represents the operational status of a network device.
 * Status transitions are managed by the NetworkDevice aggregate.
 *
 * Business Rules:
 * - Status must be one of the predefined valid statuses
 * - Status cannot be null or empty
 * - Status transitions must be validated by the aggregate
 *
 * @example
 * const statusResult = NetworkDeviceStatus.createOnline();
 * if (statusResult.isSuccess) {
 *   const status = statusResult.value;
 *   console.log(status.getDisplayName()); // 'Online'
 *   console.log(status.isOnline()); // true
 * }
 */
export class NetworkDeviceStatus extends ValueObject<NetworkDeviceStatusProps> {
  /**
   * Status constants for type-safe status values
   */
  public static readonly ONLINE = 'ONLINE';
  public static readonly OFFLINE = 'OFFLINE';
  public static readonly MAINTENANCE = 'MAINTENANCE';
  public static readonly UNKNOWN = 'UNKNOWN';

  /**
   * Valid status values
   */
  private static readonly VALID_STATUSES = [
    NetworkDeviceStatus.ONLINE,
    NetworkDeviceStatus.OFFLINE,
    NetworkDeviceStatus.MAINTENANCE,
    NetworkDeviceStatus.UNKNOWN
  ] as const;

  get value(): string {
    return this._props.value;
  }

  private constructor(_props: NetworkDeviceStatusProps) {
    super(_props);
  }

  /**
   * Creates a NetworkDeviceStatus from a string value.
   *
   * @param status - Status string (ONLINE, OFFLINE, MAINTENANCE, UNKNOWN)
   * @returns Result containing NetworkDeviceStatus or error message
   */
  public static create(status: string): Result<NetworkDeviceStatus> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(status, 'status'),
      Guard.isString(status, 'status')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<NetworkDeviceStatus>(guardResult.message!);
    }

    const trimmedStatus = status.trim().toUpperCase();

    if (trimmedStatus.length === 0) {
      return Result.fail<NetworkDeviceStatus>(
        'Status cannot be empty'
      );
    }

    if (!this.isValid(trimmedStatus)) {
      return Result.fail<NetworkDeviceStatus>(
        `Invalid device status: ${status}. Must be one of: ${this.VALID_STATUSES.join(', ')}`
      );
    }

    return Result.ok<NetworkDeviceStatus>(
      new NetworkDeviceStatus({ value: trimmedStatus })
    );
  }

  /**
   * Factory method to create an ONLINE status.
   */
  public static createOnline(): NetworkDeviceStatus {
    return new NetworkDeviceStatus({ value: this.ONLINE });
  }

  /**
   * Factory method to create an OFFLINE status.
   */
  public static createOffline(): NetworkDeviceStatus {
    return new NetworkDeviceStatus({ value: this.OFFLINE });
  }

  /**
   * Factory method to create a MAINTENANCE status.
   */
  public static createMaintenance(): NetworkDeviceStatus {
    return new NetworkDeviceStatus({ value: this.MAINTENANCE });
  }

  /**
   * Factory method to create an UNKNOWN status.
   */
  public static createUnknown(): NetworkDeviceStatus {
    return new NetworkDeviceStatus({ value: this.UNKNOWN });
  }

  /**
   * Validates if a string is a valid NetworkDeviceStatus.
   */
  private static isValid(value: string): boolean {
    return this.VALID_STATUSES.includes(
      value as (typeof this.VALID_STATUSES)[number]
    );
  }

  /**
   * Checks if this status is ONLINE.
   */
  public isOnline(): boolean {
    return this._props.value === NetworkDeviceStatus.ONLINE;
  }

  /**
   * Checks if this status is OFFLINE.
   */
  public isOffline(): boolean {
    return this._props.value === NetworkDeviceStatus.OFFLINE;
  }

  /**
   * Checks if this status is MAINTENANCE.
   */
  public isMaintenance(): boolean {
    return this._props.value === NetworkDeviceStatus.MAINTENANCE;
  }

  /**
   * Checks if this status is UNKNOWN.
   */
  public isUnknown(): boolean {
    return this._props.value === NetworkDeviceStatus.UNKNOWN;
  }

  /**
   * Gets a user-friendly display name for this status.
   *
   * @returns Human-readable name
   */
  public getDisplayName(): string {
    switch (this._props.value) {
      case NetworkDeviceStatus.ONLINE:
        return 'Online';
      case NetworkDeviceStatus.OFFLINE:
        return 'Offline';
      case NetworkDeviceStatus.MAINTENANCE:
        return 'Maintenance';
      case NetworkDeviceStatus.UNKNOWN:
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
      case NetworkDeviceStatus.ONLINE:
        return 'green';
      case NetworkDeviceStatus.OFFLINE:
        return 'red';
      case NetworkDeviceStatus.MAINTENANCE:
        return 'yellow';
      case NetworkDeviceStatus.UNKNOWN:
      default:
        return 'gray';
    }
  }

  /**
   * Checks if a status transition to another status is valid.
   *
   * Business rules:
   * - UNKNOWN can transition to any status
   * - MAINTENANCE can transition to any status (when exiting maintenance)
   * - Any status can transition to MAINTENANCE
   * - ONLINE <-> OFFLINE transitions are allowed
   * - All other transitions are not allowed
   *
   * @param toStatus - Target status to transition to
   * @returns True if transition is allowed
   */
  public canTransitionTo(toStatus: NetworkDeviceStatus): boolean {
    const from = this._props.value;
    const to = toStatus._props.value;

    // UNKNOWN can transition to any status
    if (from === NetworkDeviceStatus.UNKNOWN) {
      return true;
    }

    // MAINTENANCE can transition to any status (when exiting maintenance)
    if (from === NetworkDeviceStatus.MAINTENANCE) {
      return true;
    }

    // Any status can transition to MAINTENANCE
    if (to === NetworkDeviceStatus.MAINTENANCE) {
      return true;
    }

    // ONLINE <-> OFFLINE transitions are allowed
    if (
      (from === NetworkDeviceStatus.ONLINE &&
        to === NetworkDeviceStatus.OFFLINE) ||
      (from === NetworkDeviceStatus.OFFLINE &&
        to === NetworkDeviceStatus.ONLINE)
    ) {
      return true;
    }

    // All other transitions are not allowed
    return false;
  }

  /**
   * Returns the string representation of the status.
   */
  public toString(): string {
    return this._props.value;
  }

  // equals() inherited from ValueObject base class
}
