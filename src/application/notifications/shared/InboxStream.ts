import { InboxNotification } from 'domain/notifications/entities';
import { IInboxNotificationRepository } from 'domain/notifications/repository';
import {
  IEventStreamHub,
  ILogger
} from 'application/shared/interfaces';
import {
  INBOX_NOTIFICATION_EVENT,
  INBOX_UNREAD_EVENT,
  inboxUserChannel
} from '../channels';
import { InboxNotificationMapper } from '../mappers';

// Pushes inbox changes to the user's open tabs (NOT-265, NOT-269). A failed
// push is logged, never returned: the change itself is already saved, and the
// next opening frame carries the right count.
export class InboxStream {
  constructor(
    private readonly hub: IEventStreamHub,
    private readonly repository: IInboxNotificationRepository,
    private readonly logger: ILogger
  ) {}

  async unreadChanged(userId: string): Promise<void> {
    const channel = inboxUserChannel(userId);
    // nobody is watching, so the count query would be wasted
    if (this.hub.clientCount(channel) === 0) return;

    const unread = await this.countUnread(userId);
    if (unread === null) return;
    this.hub.publish(channel, INBOX_UNREAD_EVENT, { unread });
  }

  async notificationAdded(
    notification: InboxNotification
  ): Promise<void> {
    const channel = inboxUserChannel(notification.userId);
    if (this.hub.clientCount(channel) === 0) return;

    const unread = await this.countUnread(notification.userId);
    if (unread === null) return;
    this.hub.publish(channel, INBOX_NOTIFICATION_EVENT, {
      notification: InboxNotificationMapper.toDTO(notification),
      unread
    });
  }

  private async countUnread(userId: string): Promise<number | null> {
    const unread = await this.repository.countUnread(userId);
    if (unread.isFailure) {
      this.logger.warn('[InboxStream] Could not count unread', {
        userId,
        error: unread.error
      });
      return null;
    }
    return unread.value;
  }
}
