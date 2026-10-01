// Source: src/infrastructure/di/notificationSettingsDefaults.ts

import { loadNotificationSettingsDefaults } from '../../../src/infrastructure/di/notificationSettingsDefaults';

describe('[NOT-201] loadNotificationSettingsDefaults', () => {
  it('reads the three env values', () => {
    const settings = loadNotificationSettingsDefaults({
      TELEGRAM_CHAT_ID: '-5281991170',
      DEVICE_DOWN_ALERT_DELAY_MINUTES: '15',
      WIRELESS_ALERT_NOTIFICATIONS_ENABLED: 'false'
    });

    expect(settings.telegramChatId).toBe('-5281991170');
    expect(settings.downAlertDelayMinutes).toBe(15);
    expect(settings.wirelessAlertsEnabled).toBe(false);
  });

  it('falls back to no chat, 60 minutes and wireless alerts on', () => {
    const settings = loadNotificationSettingsDefaults({});

    expect(settings.telegramChatId).toBeNull();
    expect(settings.downAlertDelayMinutes).toBe(60);
    expect(settings.wirelessAlertsEnabled).toBe(true);
  });

  it('stops the boot on a delay the dashboard would refuse', () => {
    expect(() =>
      loadNotificationSettingsDefaults({
        DEVICE_DOWN_ALERT_DELAY_MINUTES: 'sixty'
      })
    ).toThrow('Notification settings in env: downAlertDelayMinutes');
  });

  it('stops the boot on a chat id the dashboard would refuse', () => {
    expect(() =>
      loadNotificationSettingsDefaults({
        TELEGRAM_CHAT_ID: 'my-group'
      })
    ).toThrow('Notification settings in env: telegramChatId');
  });
});
