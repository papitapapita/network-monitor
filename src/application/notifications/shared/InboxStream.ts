import { IInboxNotificationRepository } from 'domain/notifications/repository';
import {
  IEventStreamHub,
  ILogger
} from 'application/shared/interfaces';
import { INBOX_UNREAD_EVENT, inboxUserChannel } from '../channels';

// Pushes inbox changes to the user's open tabs (NOT-265). A failed push is
// logged, never returned: the change itself is already saved, and the next
// opening frame carries the right count.
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

    const unread = await this.repository.countUnread(userId);
    if (unread.isFailure) {
      this.logger.warn('[InboxStream] Could not count unread', {
        userId,
        error: unread.error
      });
      return;
    }
    this.hub.publish(channel, INBOX_UNREAD_EVENT, {
      unread: unread.value
    });
  }
}
