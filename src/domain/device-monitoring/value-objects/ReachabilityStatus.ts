import { ValueObject, Result, Guard } from 'domain/shared/core';
import { ReachabilityStatusProps } from '../props/ReachabilityStatusProps';

export class ReachabilityStatus extends ValueObject<ReachabilityStatusProps> {
  public static readonly UP = 'UP';
  public static readonly DOWN = 'DOWN';
  public static readonly UNKNOWN = 'UNKNOWN';

  private static readonly VALID_STATUSES = [
    ReachabilityStatus.UP,
    ReachabilityStatus.DOWN,
    ReachabilityStatus.UNKNOWN
  ] as const;

  get value(): string {
    return this._props.value;
  }

  private constructor(props: ReachabilityStatusProps) {
    super(props);
  }

  public static create(status: string): Result<ReachabilityStatus> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(status, 'status'),
      Guard.isString(status, 'status')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<ReachabilityStatus>(guardResult.message!);
    }

    const trimmed = status.trim().toUpperCase();

    if (trimmed.length === 0) {
      return Result.fail<ReachabilityStatus>(
        'Reachability status cannot be empty'
      );
    }

    if (!ReachabilityStatus.isValid(trimmed)) {
      return Result.fail<ReachabilityStatus>(
        `Invalid reachability status: ${status}. Must be one of: ${ReachabilityStatus.VALID_STATUSES.join(', ')}`
      );
    }

    return Result.ok<ReachabilityStatus>(
      new ReachabilityStatus({ value: trimmed })
    );
  }

  public static createUp(): ReachabilityStatus {
    return new ReachabilityStatus({ value: ReachabilityStatus.UP });
  }

  public static createDown(): ReachabilityStatus {
    return new ReachabilityStatus({ value: ReachabilityStatus.DOWN });
  }

  public static createUnknown(): ReachabilityStatus {
    return new ReachabilityStatus({
      value: ReachabilityStatus.UNKNOWN
    });
  }

  // public, unlike DeviceStatus.isValid — the persistence mapper holds a stored
  // value to the same set without normalising it first
  public static isValid(value: string): boolean {
    return ReachabilityStatus.VALID_STATUSES.includes(
      value as (typeof ReachabilityStatus.VALID_STATUSES)[number]
    );
  }

  public isUp(): boolean {
    return this._props.value === ReachabilityStatus.UP;
  }

  public isDown(): boolean {
    return this._props.value === ReachabilityStatus.DOWN;
  }

  public isUnknown(): boolean {
    return this._props.value === ReachabilityStatus.UNKNOWN;
  }

  public toString(): string {
    return this._props.value;
  }
}
