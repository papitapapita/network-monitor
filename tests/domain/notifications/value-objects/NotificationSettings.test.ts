// Source: src/domain/notifications/value-objects/NotificationSettings.ts

import {
  NotificationSettings,
  MAX_DOWN_ALERT_DELAY_MINUTES
} from '../../../../src/domain/notifications/value-objects/NotificationSettings';
import { NotificationSettingsProps } from '../../../../src/domain/notifications/props/NotificationSettingsProps';

function makeProps(
  overrides: Partial<NotificationSettingsProps> = {}
): NotificationSettingsProps {
  return {
    telegramChatId: '-1001234567890',
    downAlertDelayMinutes: 60,
    wirelessAlertsEnabled: true,
    ...overrides
  };
}

describe('[NOT-200] NotificationSettings', () => {
  describe('telegramChatId', () => {
    it.each(['-1001234567890', '8468052749', '@isp_alertas'])(
      'accepts %s',
      (chatId) => {
        const result = NotificationSettings.create(
          makeProps({ telegramChatId: chatId })
        );

        expect(result.value.telegramChatId).toBe(chatId);
      }
    );

    it('trims surrounding spaces', () => {
      const result = NotificationSettings.create(
        makeProps({ telegramChatId: '  -100123  ' })
      );

      expect(result.value.telegramChatId).toBe('-100123');
    });

    it.each([null, '', '   '])(
      'treats %p as no chat configured',
      (chatId) => {
        const result = NotificationSettings.create(
          makeProps({ telegramChatId: chatId })
        );

        expect(result.value.telegramChatId).toBeNull();
      }
    );

    it.each(['test-chat-id', '12ab', '@abc', 'https://t.me/x'])(
      'refuses %s',
      (chatId) => {
        const result = NotificationSettings.create(
          makeProps({ telegramChatId: chatId })
        );

        expect(result.error).toBe(
          'telegramChatId must be a numeric chat id or a @channel name'
        );
      }
    );
  });

  describe('downAlertDelayMinutes', () => {
    it.each([0, 5, MAX_DOWN_ALERT_DELAY_MINUTES])(
      'accepts %d',
      (n) => {
        const result = NotificationSettings.create(
          makeProps({ downAlertDelayMinutes: n })
        );

        expect(result.value.downAlertDelayMs).toBe(n * 60_000);
      }
    );

    it.each([-1, 1.5, MAX_DOWN_ALERT_DELAY_MINUTES + 1, NaN])(
      'refuses %d',
      (n) => {
        const result = NotificationSettings.create(
          makeProps({ downAlertDelayMinutes: n })
        );

        expect(result.error).toContain('downAlertDelayMinutes');
      }
    );
  });

  it('refuses a wireless switch that is not a boolean', () => {
    const result = NotificationSettings.create(
      makeProps({
        wirelessAlertsEnabled: 'yes' as unknown as boolean
      })
    );

    expect(result.error).toBe(
      'wirelessAlertsEnabled must be true or false'
    );
  });
});
