import { AlertSeverity } from 'domain/shared/enums';

export interface SendAlertNotificationDTO {
  deviceId: string;
  severity: AlertSeverity;
  source: string;
  subject: string;
  detail: string;
  occurredAt: Date;
  resolved: boolean;
}
