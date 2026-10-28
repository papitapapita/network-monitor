import { Entity, Guard, Result } from 'domain/shared/core';
import { AlertSeverity } from 'domain/shared/enums';
import { InboxNotificationId } from 'domain/shared/ids';
import { InboxCategory, InboxNotificationProps } from '../props';

const MAX_TYPE_LENGTH = 100;

const DEVICE_TYPES = new Set([
  'device_unreachable',
  'device_discovered'
]);

const SECURITY_TYPES = new Set([
  'sign_in_paused',
  'two_factor_reset'
]);

export interface InboxNotificationInput {
  userId: string;
  severity: AlertSeverity;
  resolved: boolean;
  type: string;
  title: string;
  body?: string | null;
  deviceId?: string | null;
  alertId?: string | null;
  occurredAt: Date;
}

// One user's copy of something the install told its staff (NOT-260). Each
// recipient gets their own, so reading it never marks it read for anyone else.
export class InboxNotification extends Entity<
  InboxNotificationProps,
  InboxNotificationId
> {
  private constructor(
    props: InboxNotificationProps,
    id: InboxNotificationId
  ) {
    super(props, id);
  }

  get userId(): string {
    return this.props.userId;
  }

  get category(): InboxCategory {
    return this.props.category;
  }

  get severity(): AlertSeverity {
    return this.props.severity;
  }

  get resolved(): boolean {
    return this.props.resolved;
  }

  get type(): string {
    return this.props.type;
  }

  get title(): string {
    return this.props.title;
  }

  get body(): string | null {
    return this.props.body;
  }

  get deviceId(): string | null {
    return this.props.deviceId;
  }

  get alertId(): string | null {
    return this.props.alertId;
  }

  get dedupKey(): string {
    return this.props.dedupKey;
  }

  get occurredAt(): Date {
    return this.props.occurredAt;
  }

  get readAt(): Date | null {
    return this.props.readAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get isRead(): boolean {
    return this.props.readAt !== null;
  }

  public static create(
    input: InboxNotificationInput,
    id: InboxNotificationId = InboxNotificationId.create()
  ): Result<InboxNotification> {
    const guard = Guard.againstNullOrUndefinedBulk([
      { argument: input?.userId, argumentName: 'userId' },
      { argument: input?.severity, argumentName: 'severity' },
      { argument: input?.resolved, argumentName: 'resolved' },
      { argument: input?.type, argumentName: 'type' },
      { argument: input?.title, argumentName: 'title' },
      { argument: input?.occurredAt, argumentName: 'occurredAt' }
    ]);
    if (!guard.succeeded) {
      return Result.fail<InboxNotification>(guard.message!);
    }

    const userId = input.userId.trim();
    const type = input.type.trim();
    const title = input.title.trim();
    const deviceId = input.deviceId ?? null;

    const error =
      (userId ? null : 'userId is required') ??
      (type ? null : 'type is required') ??
      (type.length <= MAX_TYPE_LENGTH
        ? null
        : `type must be at most ${MAX_TYPE_LENGTH} characters`) ??
      (title ? null : 'title is required') ??
      (Object.values(AlertSeverity).includes(input.severity)
        ? null
        : 'severity must be WARNING or CRITICAL') ??
      (Number.isNaN(input.occurredAt.getTime())
        ? 'occurredAt must be a valid date'
        : null);
    if (error) return Result.fail<InboxNotification>(error);

    return Result.ok(
      new InboxNotification(
        {
          userId,
          category: InboxNotification.categoryFor(type),
          severity: input.severity,
          resolved: input.resolved,
          type,
          title,
          body: input.body?.trim() || null,
          deviceId,
          alertId: input.alertId ?? null,
          dedupKey: InboxNotification.dedupKeyFor(
            type,
            deviceId,
            input.resolved,
            input.occurredAt
          ),
          occurredAt: input.occurredAt,
          readAt: null,
          createdAt: new Date()
        },
        id
      )
    );
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: InboxNotificationId,
    props: InboxNotificationProps
  ): InboxNotification {
    return new InboxNotification(props, id);
  }

  // NOT-264
  public static categoryFor(type: string): InboxCategory {
    if (DEVICE_TYPES.has(type)) return 'device';
    if (type.startsWith('wireless:')) return 'wireless';
    if (type.startsWith('agent_')) return 'agent';
    if (type.startsWith('backup_')) return 'backup';
    if (SECURITY_TYPES.has(type)) return 'security';
    return 'other';
  }

  // NOT-262: the first read is the one kept.
  public markRead(at: Date): void {
    if (this.props.readAt === null) this.props.readAt = at;
  }

  // The same condition starting at the same moment is the same notice, however
  // many times its delivery is retried.
  private static dedupKeyFor(
    type: string,
    deviceId: string | null,
    resolved: boolean,
    occurredAt: Date
  ): string {
    return [
      type,
      deviceId ?? 'install',
      resolved ? 'resolved' : 'open',
      occurredAt.toISOString()
    ].join('|');
  }
}
