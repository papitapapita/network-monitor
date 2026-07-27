import { AlertSeverity } from 'domain/notifications/enums';

export interface SendAlertNotificationDTO {
  deviceId: string;
  severity: AlertSeverity;
  source: string;
  subject: string;
  detail: string;
  occurredAt: Date;
  resolved: boolean;
}
