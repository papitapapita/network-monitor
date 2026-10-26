import { Entity, Result } from 'domain/shared/core';
import {
  DeviceId,
  DeviceNotificationPolicyId
} from 'domain/shared/ids';
import { TimeOfDay } from 'domain/shared/value-objects';
import { QuietHours } from '../value-objects';
import {
  DeviceNotificationPolicyProps,
  QuietHoursMode
} from '../props';

export const QUIET_HOURS_MODES: readonly QuietHoursMode[] = [
  'INHERIT',
  'CUSTOM',
  'ALWAYS_NOTIFY'
];

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

  get quietHoursMode(): QuietHoursMode {
    return this.props.quietHoursMode;
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
      quietHoursMode: QuietHoursMode;
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

    const modeResult = DeviceNotificationPolicy.validateQuietHours(
      props.quietHoursMode,
      props.quietHours
    );
    if (modeResult.isFailure) {
      return Result.fail<DeviceNotificationPolicy>(modeResult.error);
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
          quietHoursMode: props.quietHoursMode,
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

  public setQuietHours(
    mode: QuietHoursMode,
    quietHours: QuietHours | null
  ): Result<void> {
    const guard = DeviceNotificationPolicy.validateQuietHours(
      mode,
      quietHours
    );
    if (guard.isFailure) {
      return Result.fail<void>(guard.error);
    }

    this.props.quietHoursMode = mode;
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

  public effectiveQuietHours(
    installQuietHours: QuietHours | null
  ): QuietHours | null {
    switch (this.props.quietHoursMode) {
      case 'INHERIT':
        return installQuietHours;
      case 'CUSTOM':
        return this.props.quietHours;
      case 'ALWAYS_NOTIFY':
        return null;
    }
  }

  // Server-local wall clock — quiet hours are set by the operator watching
  // their own clock, not a timezone stored per device.
  public isWithinQuietHours(
    now: Date,
    installQuietHours: QuietHours | null
  ): boolean {
    const window = this.effectiveQuietHours(installQuietHours);
    if (window === null) return false;
    return window.contains(TimeOfDay.fromDate(now));
  }

  public effectiveAlertDelayMs(defaultMs: number): number {
    return this.props.alertDelayMinutes !== null
      ? this.props.alertDelayMinutes * 60_000
      : defaultMs;
  }

  private static validateQuietHours(
    mode: QuietHoursMode,
    quietHours: QuietHours | null
  ): Result<void> {
    if (!QUIET_HOURS_MODES.includes(mode)) {
      return Result.fail<void>(
        `quietHoursMode must be one of: ${QUIET_HOURS_MODES.join(', ')}`
      );
    }
    if ((mode === 'CUSTOM') !== (quietHours !== null)) {
      return Result.fail<void>(
        'quietHoursStart and quietHoursEnd must be set when quietHoursMode is CUSTOM, and only then'
      );
    }
    return Result.ok<void>();
  }

  private static validateDelay(minutes: number | null): Result<void> {
    if (minutes === null) return Result.ok<void>();
    if (!Number.isFinite(minutes) || minutes < 0) {
      return Result.fail<void>('alertDelayMinutes must be >= 0');
    }
    return Result.ok<void>();
  }
}
