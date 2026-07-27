import { Result } from 'domain/shared/core';
import { AlertSeverity } from 'domain/notifications/enums';
import {
  IWirelessAlertNotifier,
  WirelessAlertClearedNotification,
  WirelessAlertTriggeredNotification
} from 'application/wireless-monitoring/interfaces';
import { SendAlertNotificationUseCase } from 'application/notifications/use-cases';

const SOURCE = 'Enlace inalámbrico';

export class WirelessAlertNotifier implements IWirelessAlertNotifier {
  constructor(
    private readonly sendAlertNotificationUseCase: SendAlertNotificationUseCase
  ) {}

  async notifyTriggered(
    notification: WirelessAlertTriggeredNotification
  ): Promise<Result<void>> {
    const result = await this.sendAlertNotificationUseCase.execute({
      deviceId: notification.deviceId,
      severity: this.toAlertSeverity(notification.severity),
      source: SOURCE,
      subject: notification.metric,
      detail: notification.message,
      occurredAt: notification.triggeredAt,
      resolved: false
    });

    return result.isFailure ? Result.fail(result.error) : Result.ok();
  }

  async notifyCleared(
    notification: WirelessAlertClearedNotification
  ): Promise<Result<void>> {
    const result = await this.sendAlertNotificationUseCase.execute({
      deviceId: notification.deviceId,
      severity: this.toAlertSeverity(notification.severity),
      source: SOURCE,
      subject: notification.metric,
      detail: `La condición de alerta en ${notification.metric} se ha normalizado.`,
      occurredAt: notification.clearedAt,
      resolved: true
    });

    return result.isFailure ? Result.fail(result.error) : Result.ok();
  }

  private toAlertSeverity(
    severity: 'WARNING' | 'CRITICAL'
  ): AlertSeverity {
    return severity === 'CRITICAL'
      ? AlertSeverity.CRITICAL
      : AlertSeverity.WARNING;
  }
}
