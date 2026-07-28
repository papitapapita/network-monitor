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
