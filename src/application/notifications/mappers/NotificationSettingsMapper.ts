import { NotificationSettings } from 'domain/notifications/value-objects';
import { NotificationSettingsDTO } from '../dtos';

export class NotificationSettingsMapper {
  static toDTO(
    settings: NotificationSettings
  ): NotificationSettingsDTO {
    return {
      telegramChatId: settings.telegramChatId,
      downAlertDelayMinutes: settings.downAlertDelayMinutes,
      wirelessAlertsEnabled: settings.wirelessAlertsEnabled,
      alertTicketMode: settings.alertTicketMode,
      quietHoursStart: settings.quietHours?.start.toString() ?? null,
      quietHoursEnd: settings.quietHours?.end.toString() ?? null
    };
  }
}
