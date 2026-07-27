import { Result } from 'domain/shared/core';

export interface WirelessAlertTriggeredNotification {
  deviceId: string;
  metric: string;
  severity: 'WARNING' | 'CRITICAL';
  threshold: number;
  currentValue: number;
  message: string;
  triggeredAt: Date;
}

export interface WirelessAlertClearedNotification {
  deviceId: string;
  metric: string;
  severity: 'WARNING' | 'CRITICAL';
  clearedAt: Date;
}

export interface IWirelessAlertNotifier {
  notifyTriggered(
    notification: WirelessAlertTriggeredNotification
  ): Promise<Result<void>>;
  notifyCleared(
    notification: WirelessAlertClearedNotification
  ): Promise<Result<void>>;
}
