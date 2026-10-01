import { SendSubscriptionReminderUseCase } from 'application/notifications/use-cases/SendSubscriptionReminderUseCase';
import { GetSubscriptionStatusUseCase } from 'application/shared/use-cases/GetSubscriptionStatusUseCase';
import { loadVendorSettingsDefaults } from 'infrastructure/di/vendorSettingsDefaults';
import { Result } from 'domain/shared/core';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { FakeNotificationService } from '../../helpers/FakeNotificationService';

const DAY_MS = 24 * 60 * 60 * 1000;
const COLOMBIA_OFFSET_MS = -5 * 60 * 60 * 1000;

function lastPaidDayIn(days: number): string {
  return new Date(Date.now() + COLOMBIA_OFFSET_MS + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

// No database: no HTTP surface either, so this is the reminder's only
// end-to-end check — real loader, real status, fake Telegram.
describe('SendSubscriptionReminderUseCase — integration', () => {
  const logger = new WinstonLogger();
  const notifications = new FakeNotificationService();

  beforeEach(() => notifications.reset());

  function reminderFor(env: NodeJS.ProcessEnv) {
    return new SendSubscriptionReminderUseCase(
      new GetSubscriptionStatusUseCase(
        {
          get: async () => Result.ok(loadVendorSettingsDefaults(env)),
          save: async () => Result.ok()
        },
        logger
      ),
      notifications,
      logger
    );
  }

  it('[INS-027] sends nothing on an install without terms', async () => {
    const result = await reminderFor({}).execute();

    expect(result.value).toBe('NOT_DUE');
    expect(notifications.callCount).toBe(0);
  });

  it('[INS-027] reminds the install two days before the end', async () => {
    const result = await reminderFor({
      SUBSCRIPTION_PAID_UNTIL: lastPaidDayIn(2)
    }).execute();

    expect(result.value).toBe('SENT');
    expect(notifications.lastMessage!.body).toContain('vence');
    expect(notifications.lastMessage!.metadata.deviceId).toBeNull();
  });

  it('[INS-027] warns while read-only that the dashboard will lock', async () => {
    await reminderFor({
      SUBSCRIPTION_PAID_UNTIL: lastPaidDayIn(-6)
    }).execute();

    expect(notifications.lastMessage!.body).toContain('bloquea');
  });

  it('[INS-027] fails when Telegram refuses the message', async () => {
    notifications.setShouldFail(true);

    const result = await reminderFor({
      SUBSCRIPTION_PAID_UNTIL: lastPaidDayIn(2)
    }).execute();

    expect(result.isFailure).toBe(true);
  });
});
