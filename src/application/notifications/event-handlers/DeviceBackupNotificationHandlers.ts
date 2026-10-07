import { IHandle } from 'domain/shared/interfaces';
import { AlertSeverity } from 'domain/shared/enums';
import {
  DeviceBackupFailingEvent,
  DeviceConfigChangedEvent
} from 'domain/device-backups/events';
import {
  AlertNotification,
  IAlertPublisher,
  ILogger,
  isSuppressedPublish
} from 'application/shared/interfaces';
import { TelegramFormatting } from '../shared';

export const DEVICE_BACKUP_SOURCE = 'Copias de configuración';
// Plain alert types, so each can be muted for the whole install (BKP-062).
export const CONFIG_CHANGED_ALERT_TYPE = 'config_changed';
export const BACKUP_FAILING_ALERT_TYPE = 'backup_failing';

// BKP-060
export class DeviceConfigChangedNotificationHandler
  implements IHandle<DeviceConfigChangedEvent>
{
  constructor(
    private readonly alertPublisher: IAlertPublisher,
    private readonly logger: ILogger
  ) {}

  async handle(event: DeviceConfigChangedEvent): Promise<void> {
    const since = TelegramFormatting.formatLocalTime(
      event.previousCheckedAt
    );
    await publish(
      this.alertPublisher,
      this.logger,
      'DeviceConfigChangedNotificationHandler',
      {
        deviceId: event.deviceId.toString(),
        severity: AlertSeverity.WARNING,
        source: DEVICE_BACKUP_SOURCE,
        summary: `La configuración de "${event.deviceName}" cambió`,
        detail: `Seguía igual en la revisión del ${since}. Las dos versiones quedan guardadas para compararlas.`,
        occurredAt: event.dateTimeOccurred,
        resolved: false,
        type: CONFIG_CHANGED_ALERT_TYPE
      }
    );
  }
}

// BKP-061
export class DeviceBackupFailingNotificationHandler
  implements IHandle<DeviceBackupFailingEvent>
{
  constructor(
    private readonly alertPublisher: IAlertPublisher,
    private readonly logger: ILogger
  ) {}

  async handle(event: DeviceBackupFailingEvent): Promise<void> {
    const lastGood = event.lastSuccessAt
      ? `La última copia buena es del ${TelegramFormatting.formatLocalTime(event.lastSuccessAt)}.`
      : 'Todavía no tiene ninguna copia.';
    await publish(
      this.alertPublisher,
      this.logger,
      'DeviceBackupFailingNotificationHandler',
      {
        deviceId: event.aggregateId.toString(),
        severity: AlertSeverity.WARNING,
        source: DEVICE_BACKUP_SOURCE,
        summary: `La copia de configuración de "${event.deviceName}" falló ${event.consecutiveFailures} veces seguidas`,
        detail: `${lastGood} Último error: ${event.lastError}`,
        occurredAt: event.dateTimeOccurred,
        resolved: false,
        type: BACKUP_FAILING_ALERT_TYPE
      }
    );
  }
}

async function publish(
  alertPublisher: IAlertPublisher,
  logger: ILogger,
  handler: string,
  notification: AlertNotification
): Promise<void> {
  try {
    const result = await alertPublisher.publish(notification);
    if (result.isFailure && !isSuppressedPublish(result.error)) {
      logger.error(`${handler}: publish failed`, undefined, {
        deviceId: notification.deviceId,
        error: result.error
      });
    }
  } catch (error) {
    logger.error(
      `${handler}: unexpected error`,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
