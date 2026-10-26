import { NotificationSettings } from 'domain/notifications/value-objects';

// What applies until the administrator saves the settings from the dashboard
// (NOT-201): the env values every install ran on before, so an existing
// install behaves the same after the upgrade. A value the dashboard would
// refuse stops the boot instead of silently changing behaviour.
export function loadNotificationSettingsDefaults(
  env: NodeJS.ProcessEnv
): NotificationSettings {
  const rawDelay = env.DEVICE_DOWN_ALERT_DELAY_MINUTES?.trim();
  const delay = rawDelay ? Number(rawDelay) : 60;
  const rawWireless =
    env.WIRELESS_ALERT_NOTIFICATIONS_ENABLED?.trim();

  const result = NotificationSettings.create({
    telegramChatId: env.TELEGRAM_CHAT_ID?.trim() || null,
    downAlertDelayMinutes: delay,
    wirelessAlertsEnabled: rawWireless !== 'false',
    // No env predates this setting; suggesting is the product default.
    alertTicketMode: 'SUGGEST',
    // Nor this one: no install-wide quiet hours until the administrator
    // sets them, so every device notifies as it did before (NOT-207).
    quietHours: null
  });
  if (result.isFailure) {
    throw new Error(`Notification settings in env: ${result.error}`);
  }
  return result.value;
}
