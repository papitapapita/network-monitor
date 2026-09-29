import { AlertSeverity } from 'domain/shared/enums';

export interface SendAlertNotificationDTO {
  deviceId: string | null;
  severity: AlertSeverity;
  source: string;
  subject: string;
  detail: string;
  occurredAt: Date;
  resolved: boolean;
}
