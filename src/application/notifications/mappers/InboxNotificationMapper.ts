import { InboxNotification } from 'domain/notifications/entities';
import { InboxNotificationDTO } from '../dtos';

export class InboxNotificationMapper {
  public static toDTO(
    notification: InboxNotification
  ): InboxNotificationDTO {
    return {
      id: notification.id.toString(),
      category: notification.category,
      severity: notification.severity,
      resolved: notification.resolved,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      deviceId: notification.deviceId,
      alertId: notification.alertId,
      occurredAt: notification.occurredAt.toISOString(),
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString()
    };
  }
}
