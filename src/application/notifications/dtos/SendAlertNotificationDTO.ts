import { AlertSeverity } from 'domain/shared/enums';

export interface SendAlertNotificationDTO {
  deviceId: string | null;
  severity: AlertSeverity;
  source: string;
  summary: string;
  detail: string | null;
  occurredAt: Date;
  resolved: boolean;
}
