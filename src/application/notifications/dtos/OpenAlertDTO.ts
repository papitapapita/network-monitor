import { AlertSeverity } from 'domain/shared/enums';

export interface OpenAlertDTO {
  deviceId: string;
  severity: AlertSeverity;
  source: string;
  type: string;
  description: string;
  details: Record<string, unknown>;
  skipTicket?: boolean;
}
