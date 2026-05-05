import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { AlertId, DeviceId } from 'domain/shared/ids';
import { AlertSeverity } from '../enums';
import { AlertProps } from '../props';

export class Alert extends AggregateRoot<AlertProps, AlertId> {
  private constructor(props: AlertProps, id: AlertId) {
    super(props, id);
  }

  get alertId(): AlertId {
    return this._id;
  }

  get deviceId(): DeviceId {
    return this.props.deviceId;
  }

  get severity(): AlertSeverity {
    return this.props.severity;
  }

  get startedAt(): Date {
    return this.props.startedAt;
  }

  get resolvedAt(): Date | null {
    return this.props.resolvedAt;
  }

  get notifiedAt(): Date | null {
    return this.props.notifiedAt;
  }

  get recoveryNotifiedAt(): Date | null {
    return this.props.recoveryNotifiedAt;
  }

  get durationSecs(): number | null {
    return this.props.durationSecs;
  }

  get isOpen(): boolean {
    return this.props.resolvedAt === null;
  }

  public static open(
    deviceId: DeviceId,
    severity: AlertSeverity
  ): Result<Alert> {
    const guard = Guard.againstNullOrUndefined(deviceId, 'deviceId');
    if (!guard.succeeded) {
      return Result.fail(guard.message ?? 'deviceId is required');
    }

    const id = AlertId.create();
    const alert = new Alert(
      {
        deviceId,
        severity,
        startedAt: new Date(),
        resolvedAt: null,
        notifiedAt: null,
        recoveryNotifiedAt: null,
        durationSecs: null
      },
      id
    );

    return Result.ok(alert);
  }

  public static reconstitute(id: AlertId, props: AlertProps): Alert {
    return new Alert(props, id);
  }

  public markNotified(): Result<void> {
    if (this.props.notifiedAt !== null) {
      return Result.fail('Alert already notified');
    }
    this.props.notifiedAt = new Date();
    return Result.ok<void>();
  }

  public resolve(resolvedAt: Date): Result<void> {
    if (this.props.resolvedAt !== null) {
      return Result.fail('Alert already resolved');
    }
    this.props.resolvedAt = resolvedAt;
    this.props.durationSecs = Math.floor(
      (resolvedAt.getTime() - this.props.startedAt.getTime()) / 1000
    );
    return Result.ok<void>();
  }

  public markRecoveryNotified(): Result<void> {
    if (this.props.resolvedAt === null) {
      return Result.fail(
        'Cannot mark recovery notification on an open alert'
      );
    }
    if (this.props.recoveryNotifiedAt !== null) {
      return Result.fail('Recovery notification already sent');
    }
    this.props.recoveryNotifiedAt = new Date();
    return Result.ok<void>();
  }
}
