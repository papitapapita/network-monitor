import { AlertSeverity } from 'domain/shared/enums';
import { InboxNotificationId } from 'domain/shared/ids';
import { InboxNotification } from 'domain/notifications/entities';
import { InboxCategory } from 'domain/notifications/props';

type PrismaInboxNotificationRecord = {
  id: string;
  userId: string;
  category: string;
  severity: string;
  resolved: boolean;
  type: string;
  title: string;
  body: string | null;
  deviceId: string | null;
  alertId: string | null;
  dedupKey: string;
  occurredAt: Date;
  readAt: Date | null;
  createdAt: Date;
};

export class InboxNotificationMapper {
  public static toDomain(
    raw: PrismaInboxNotificationRecord
  ): InboxNotification {
    const idResult = InboxNotificationId.parse(raw.id);
    if (idResult.isFailure) {
      throw new Error(
        `Data integrity violation: invalid id "${raw.id}" in inbox_notifications`
      );
    }

    return InboxNotification.reconstitute(idResult.value, {
      userId: raw.userId,
      category: raw.category as InboxCategory,
      severity: raw.severity as AlertSeverity,
      resolved: raw.resolved,
      type: raw.type,
      title: raw.title,
      body: raw.body,
      deviceId: raw.deviceId,
      alertId: raw.alertId,
      dedupKey: raw.dedupKey,
      occurredAt: raw.occurredAt,
      readAt: raw.readAt,
      createdAt: raw.createdAt
    });
  }

  public static toPersistence(
    entity: InboxNotification
  ): PrismaInboxNotificationRecord {
    return {
      id: entity.id.toString(),
      userId: entity.userId,
      category: entity.category,
      severity: entity.severity,
      resolved: entity.resolved,
      type: entity.type,
      title: entity.title,
      body: entity.body,
      deviceId: entity.deviceId,
      alertId: entity.alertId,
      dedupKey: entity.dedupKey,
      occurredAt: entity.occurredAt,
      readAt: entity.readAt,
      createdAt: entity.createdAt
    };
  }
}
