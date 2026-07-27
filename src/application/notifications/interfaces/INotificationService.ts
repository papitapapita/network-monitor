import { Result } from 'domain/shared/core';

export interface NotificationMessage {
  title: string;
  body: string;
  metadata: {
    deviceId: string;
    deviceName: string;
    ipAddress: string | null;
    severity: string;
    alertId?: string;
    timestamp: string;
    consecutiveFailures?: number;
    latencyMs?: number | null;
    durationSecs?: number | null;
  };
}

export interface INotificationService {
  send(message: NotificationMessage): Promise<Result<void>>;
}
