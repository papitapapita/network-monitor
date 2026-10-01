import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { NotificationSettings } from 'domain/notifications/value-objects';
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
      return Result.ok(
        NotificationSettings.reconstitute({
          telegramChatId: row.telegramChatId,
          downAlertDelayMinutes: row.downAlertDelayMinutes,
          wirelessAlertsEnabled: row.wirelessAlertsEnabled
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
      wirelessAlertsEnabled: settings.wirelessAlertsEnabled
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
