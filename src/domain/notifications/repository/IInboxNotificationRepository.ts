import { Result } from 'domain/shared/core';
import { InboxNotificationId } from 'domain/shared/ids';
import { InboxNotification } from '../entities';

export interface InboxPageQuery {
  unreadOnly: boolean;
  limit: number;
  offset: number;
}

export interface InboxPage {
  notifications: InboxNotification[];
  total: number;
}

// Every method is scoped to one user: nobody reads or marks another user's
// inbox (NOT-260).
export interface IInboxNotificationRepository {
  // null when it does not exist or belongs to someone else.
  findByIdForUser(
    id: InboxNotificationId,
    userId: string
  ): Promise<Result<InboxNotification | null>>;
  save(
    notification: InboxNotification
  ): Promise<Result<InboxNotification>>;
  // Newest first (NOT-261).
  listForUser(
    userId: string,
    query: InboxPageQuery
  ): Promise<Result<InboxPage>>;
  countUnread(userId: string): Promise<Result<number>>;
  // Returns how many were unread before.
  markAllRead(userId: string, at: Date): Promise<Result<number>>;
}
