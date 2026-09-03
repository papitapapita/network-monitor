import { Result } from 'domain/shared/core';
import { AlertSeverity } from 'domain/shared/enums';

export interface AlertNotification {
  deviceId: string;
  severity: AlertSeverity;
  source: string;
  subject: string;
  detail: string;
  occurredAt: Date;
  resolved: boolean;
}

export interface IAlertPublisher {
  publish(notification: AlertNotification): Promise<Result<void>>;
}

// Returned by a quiet-hours-aware publisher instead of forwarding the
// notification. Callers check for this exact string so a suppressed publish
// is not logged or treated the same as a real delivery failure — see
// QuietHoursAlertPublisher.
export const QUIET_HOURS_SUPPRESSED =
  'Notification suppressed: device is in quiet hours';
