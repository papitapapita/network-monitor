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
  // Returns only the ones added: a notification the user already has (same
  // dedup key) is skipped, so a retried delivery records nothing new.
  addMany(
    notifications: InboxNotification[]
  ): Promise<Result<InboxNotification[]>>;
  // Newest first (NOT-261).
  listForUser(
    userId: string,
    query: InboxPageQuery
  ): Promise<Result<InboxPage>>;
  countUnread(userId: string): Promise<Result<number>>;
  // Returns how many were unread before.
  markAllRead(userId: string, at: Date): Promise<Result<number>>;
  // Whether any user's inbox holds the outage notice of this alert (NOT-270).
  hasOutageNotice(alertId: string): Promise<Result<boolean>>;
  // The one method across every inbox: retention (NOT-268).
  deleteOlderThan(cutoff: Date): Promise<Result<number>>;
}
