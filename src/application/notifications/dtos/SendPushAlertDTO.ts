import { AlertSeverity } from 'domain/shared/enums';

export interface SendPushAlertDTO {
  deviceId: string | null;
  severity: AlertSeverity;
  summary: string;
  detail: string | null;
  resolved: boolean;
  type: string;
}
