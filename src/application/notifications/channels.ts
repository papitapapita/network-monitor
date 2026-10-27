export function inboxUserChannel(userId: string): string {
  return `inbox:user:${userId}`;
}

// the opening frame, and again whenever the user's unread count changes
export const INBOX_UNREAD_EVENT = 'unread';

// a new notification arrived, with the count it brings the user to
export const INBOX_NOTIFICATION_EVENT = 'notification';
