import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { AlertId, DeviceId } from 'domain/shared/ids';
import { AlertSeverity } from 'domain/shared/enums';
import { AlertProps } from '../props';

export class Alert extends AggregateRoot<AlertProps, AlertId> {
  private constructor(props: AlertProps, id: AlertId) {
    super(props, id);
  }

  get deviceId(): DeviceId {
    return this.props.deviceId;
  }

  get severity(): AlertSeverity {
    return this.props.severity;
  }

  get source(): string {
    return this.props.source;
  }

  get type(): string {
    return this.props.type;
  }

  get description(): string {
    return this.props.description;
  }

  get details(): Record<string, unknown> {
    return this.props.details ?? {};
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
    if (!this.props.resolvedAt) return null;
    return Math.floor(
      (this.props.resolvedAt.getTime() -
        this.props.startedAt.getTime()) /
        1000
    );
  }

  get isOpen(): boolean {
    return this.props.resolvedAt === null;
  }

  public static open(
    deviceId: DeviceId,
    severity: AlertSeverity,
    source: string,
    type: string,
    description: string,
    details: Record<string, unknown> = {}
  ): Result<Alert> {
    const guard = Guard.againstNullOrUndefined(deviceId, 'deviceId');
    if (!guard.succeeded) {
      return Result.fail(guard.message ?? 'deviceId is required');
    }

    if (!source?.trim()) {
      return Result.fail('source is required');
    }
    if (!type?.trim()) {
      return Result.fail('type is required');
    }

    const id = AlertId.create();
    const alert = new Alert(
      {
        deviceId,
        severity,
        source,
        type,
        description,
        details,
        startedAt: new Date(),
        resolvedAt: null,
        notifiedAt: null,
        recoveryNotifiedAt: null
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
