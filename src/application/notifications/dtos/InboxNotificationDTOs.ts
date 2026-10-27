export interface InboxNotificationDTO {
  id: string;
  category: string;
  severity: string;
  resolved: boolean;
  type: string;
  title: string;
  body: string | null;
  deviceId: string | null;
  alertId: string | null;
  occurredAt: string;
  readAt: string | null;
  createdAt: string;
}

export interface ListInboxNotificationsDTO {
  userId: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface InboxNotificationListResponseDTO {
  notifications: InboxNotificationDTO[];
  total: number;
  unread: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface GetUnreadInboxCountDTO {
  userId: string;
}

export interface UnreadInboxCountDTO {
  unread: number;
}

export interface MarkInboxNotificationReadDTO {
  userId: string;
  id: string;
}

export interface MarkAllInboxNotificationsReadDTO {
  userId: string;
}

export interface MarkAllInboxNotificationsReadResponseDTO {
  marked: number;
}
