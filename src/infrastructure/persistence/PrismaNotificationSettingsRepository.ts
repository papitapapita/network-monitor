import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  NotificationSettings,
  QuietHours
} from 'domain/notifications/value-objects';
import { INotificationSettingsRepository } from 'domain/notifications/repository';

const ROW_ID = 1;

// Read on every use rather than cached: a single-row primary-key lookup, and
// a save from the dashboard must reach the next alert with no restart.
export class PrismaNotificationSettingsRepository
  implements INotificationSettingsRepository
{
  constructor(
    private readonly prisma: PrismaClient,
    private readonly defaults: NotificationSettings
  ) {}

  async get(): Promise<Result<NotificationSettings>> {
    try {
      const row = await this.prisma.notificationSettings.findUnique({
        where: { id: ROW_ID }
      });
      if (!row) return Result.ok(this.defaults);

      let quietHours: QuietHours | null = null;
      if (
        row.quietHoursStart !== null &&
        row.quietHoursEnd !== null
      ) {
        const window = QuietHours.fromHHmm(
          row.quietHoursStart,
          row.quietHoursEnd
        );
        if (window.isFailure) {
          return Result.fail(
            `Data integrity violation: invalid quiet hours "${row.quietHoursStart}"-"${row.quietHoursEnd}" in notification_settings`
          );
        }
        quietHours = window.value;
      }

      return Result.ok(
        NotificationSettings.reconstitute({
          telegramChatId: row.telegramChatId,
          downAlertDelayMinutes: row.downAlertDelayMinutes,
          wirelessAlertsEnabled: row.wirelessAlertsEnabled,
          alertTicketMode: row.alertTicketMode,
          quietHours
        })
      );
    } catch (error) {
      return Result.fail(
        `Database error reading notification settings: ${(error as Error).message}`
      );
    }
  }

  async save(settings: NotificationSettings): Promise<Result<void>> {
    const data = {
      telegramChatId: settings.telegramChatId,
      downAlertDelayMinutes: settings.downAlertDelayMinutes,
      wirelessAlertsEnabled: settings.wirelessAlertsEnabled,
      alertTicketMode: settings.alertTicketMode,
      quietHoursStart: settings.quietHours?.start.toString() ?? null,
      quietHoursEnd: settings.quietHours?.end.toString() ?? null
    };
    try {
      await this.prisma.notificationSettings.upsert({
        where: { id: ROW_ID },
        create: { id: ROW_ID, ...data },
        update: data
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error saving notification settings: ${(error as Error).message}`
      );
    }
  }
}
