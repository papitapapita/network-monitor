import { AlertSeverity } from 'domain/shared/enums';

export type InboxCategory =
  | 'device'
  | 'wireless'
  | 'agent'
  | 'backup'
  | 'security'
  | 'other';

export interface InboxNotificationProps {
  userId: string;
  category: InboxCategory;
  severity: AlertSeverity;
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
}
