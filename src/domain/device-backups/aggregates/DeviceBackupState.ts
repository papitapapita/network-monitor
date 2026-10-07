import { AggregateRoot, Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { BackupOutcome } from '../enums';
import { DeviceBackupStateProps } from '../props';
import { DeviceBackupFailingEvent } from '../events';

export const MAX_BACKUP_ERROR_LENGTH = 500;
export const BACKUP_FAILURES_BEFORE_ALERT = 3;

// How the latest backup attempts of one device went, so a device that keeps
// failing shows since when and why (BKP-020).
export class DeviceBackupState extends AggregateRoot<
  DeviceBackupStateProps,
  DeviceId
> {
  private constructor(props: DeviceBackupStateProps, id: DeviceId) {
    super(props, id);
  }

  get deviceId(): DeviceId {
    return this._id;
  }

  get lastAttemptAt(): Date | null {
    return this.props.lastAttemptAt;
  }

  get lastOutcome(): BackupOutcome | null {
    return this.props.lastOutcome;
  }

  get lastError(): string | null {
    return this.props.lastError;
  }

  get lastSuccessAt(): Date | null {
    return this.props.lastSuccessAt;
  }

  get failingSince(): Date | null {
    return this.props.failingSince;
  }

  get consecutiveFailures(): number {
    return this.props.consecutiveFailures;
  }

  public static create(
    deviceId: DeviceId
  ): Result<DeviceBackupState> {
    if (!deviceId)
      return Result.fail('deviceId is null or undefined');
    return Result.ok(
      new DeviceBackupState(
        {
          lastAttemptAt: null,
          lastOutcome: null,
          lastError: null,
          lastSuccessAt: null,
          failingSince: null,
          consecutiveFailures: 0
        },
        deviceId
      )
    );
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    deviceId: DeviceId,
    props: DeviceBackupStateProps
  ): DeviceBackupState {
    return new DeviceBackupState(props, deviceId);
  }

  public recordSuccess(
    outcome: BackupOutcome.SAVED | BackupOutcome.UNCHANGED,
    at: Date
  ): Result<void> {
    return this.apply({
      lastAttemptAt: at,
      lastOutcome: outcome,
      lastError: null,
      lastSuccessAt: at,
      failingSince: null,
      consecutiveFailures: 0
    });
  }

  // A long device error is cut rather than refused: the attempt still counts.
  // `alertable` false: the device is left out because backing it up is not
  // available yet, which is no news to anyone (BKP-063).
  public recordFailure(
    error: string,
    at: Date,
    deviceName: string,
    alertable = true
  ): Result<void> {
    const reason = (error ?? '').trim() || 'Unknown error';
    const next: DeviceBackupStateProps = {
      lastAttemptAt: at,
      lastOutcome: BackupOutcome.FAILED,
      lastError: reason.slice(0, MAX_BACKUP_ERROR_LENGTH),
      lastSuccessAt: this.props.lastSuccessAt,
      failingSince: this.props.failingSince ?? at,
      consecutiveFailures: this.props.consecutiveFailures + 1
    };
    const applied = this.apply(next);
    if (applied.isFailure) return applied;

    // BKP-061: once per streak, so one bad night pages no one and a device
    // that stays broken is not reported every night.
    if (
      alertable &&
      next.consecutiveFailures === BACKUP_FAILURES_BEFORE_ALERT
    )
      this.addDomainEvent(
        new DeviceBackupFailingEvent({
          aggregateId: this._id,
          deviceName,
          consecutiveFailures: next.consecutiveFailures,
          failingSince: next.failingSince!,
          lastSuccessAt: next.lastSuccessAt,
          lastError: next.lastError!,
          dateTimeOccurred: at
        })
      );
    return applied;
  }

  public succeededSince(cutoff: Date): boolean {
    return (
      this.props.lastSuccessAt !== null &&
      this.props.lastSuccessAt.getTime() >= cutoff.getTime()
    );
  }

  private apply(next: DeviceBackupStateProps): Result<void> {
    const validation = DeviceBackupState.validate(next);
    if (validation.isFailure) return Result.fail(validation.error);
    this.props = next;
    return Result.ok();
  }

  private static validate(
    props: DeviceBackupStateProps
  ): Result<void> {
    if (
      !Number.isInteger(props.consecutiveFailures) ||
      props.consecutiveFailures < 0
    )
      return Result.fail(
        'Consecutive backup failures must be a non-negative integer'
      );
    if (
      props.lastOutcome !== null &&
      !Object.values(BackupOutcome).includes(props.lastOutcome)
    )
      return Result.fail(
        `Unknown backup outcome: ${props.lastOutcome}`
      );

    const failing = props.lastOutcome === BackupOutcome.FAILED;
    if (failing !== (props.lastError !== null))
      return Result.fail(
        'A backup error is kept only while the last attempt failed'
      );
    if (failing !== props.consecutiveFailures > 0)
      return Result.fail(
        'Consecutive backup failures count only while the last attempt failed'
      );
    if (failing !== (props.failingSince !== null))
      return Result.fail(
        'A device is failing since a date only while its last attempt failed'
      );
    if (
      props.lastError !== null &&
      props.lastError.length > MAX_BACKUP_ERROR_LENGTH
    )
      return Result.fail(
        `A backup error cannot exceed ${MAX_BACKUP_ERROR_LENGTH} characters`
      );
    return Result.ok();
  }
}
