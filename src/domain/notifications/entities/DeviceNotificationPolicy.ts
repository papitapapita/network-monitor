import { Entity, Result } from 'domain/shared/core';
import {
  DeviceId,
  DeviceNotificationPolicyId
} from 'domain/shared/ids';
import { QuietHours, TimeOfDay } from '../value-objects';
import { DeviceNotificationPolicyProps } from '../props';

export class DeviceNotificationPolicy extends Entity<
  DeviceNotificationPolicyProps,
  DeviceNotificationPolicyId
> {
  private constructor(
    props: DeviceNotificationPolicyProps,
    id: DeviceNotificationPolicyId
  ) {
    super(props, id);
  }

  get deviceId(): DeviceId {
    return this.props.deviceId;
  }

  get quietHours(): QuietHours | null {
    return this.props.quietHours;
  }

  get alertDelayMinutes(): number | null {
    return this.props.alertDelayMinutes;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public static create(
    props: {
      deviceId: DeviceId;
      quietHours: QuietHours | null;
      alertDelayMinutes: number | null;
    },
    id: DeviceNotificationPolicyId
  ): Result<DeviceNotificationPolicy> {
    if (!props.deviceId) {
      return Result.fail<DeviceNotificationPolicy>(
        'deviceId is null or undefined'
      );
    }

    const delayResult = DeviceNotificationPolicy.validateDelay(
      props.alertDelayMinutes
    );
    if (delayResult.isFailure) {
      return Result.fail<DeviceNotificationPolicy>(delayResult.error);
    }

    const now = new Date();
    return Result.ok<DeviceNotificationPolicy>(
      new DeviceNotificationPolicy(
        {
          deviceId: props.deviceId,
          quietHours: props.quietHours,
          alertDelayMinutes: props.alertDelayMinutes,
          createdAt: now,
          updatedAt: now
        },
        id
      )
    );
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: DeviceNotificationPolicyId,
    props: DeviceNotificationPolicyProps
  ): DeviceNotificationPolicy {
    return new DeviceNotificationPolicy(props, id);
  }

  public setQuietHours(quietHours: QuietHours | null): Result<void> {
    this.props.quietHours = quietHours;
    this.props.updatedAt = new Date();
    return Result.ok<void>();
  }

  public setAlertDelayMinutes(minutes: number | null): Result<void> {
    const guard = DeviceNotificationPolicy.validateDelay(minutes);
    if (guard.isFailure) {
      return Result.fail<void>(guard.error);
    }

    this.props.alertDelayMinutes = minutes;
    this.props.updatedAt = new Date();
    return Result.ok<void>();
  }

  // Server-local wall clock — quiet hours are set by the operator watching
  // their own clock, not a timezone stored per device.
  public isWithinQuietHours(now: Date): boolean {
    if (this.props.quietHours === null) return false;
    return this.props.quietHours.contains(TimeOfDay.fromDate(now));
  }

  public effectiveAlertDelayMs(defaultMs: number): number {
    return this.props.alertDelayMinutes !== null
      ? this.props.alertDelayMinutes * 60_000
      : defaultMs;
  }

  private static validateDelay(minutes: number | null): Result<void> {
    if (minutes === null) return Result.ok<void>();
    if (!Number.isFinite(minutes) || minutes < 0) {
      return Result.fail<void>('alertDelayMinutes must be >= 0');
    }
    return Result.ok<void>();
  }
}
