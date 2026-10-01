import { z } from 'zod';

// Shape only; the rules on each value live in NotificationSettings (NOT-200).
export const updateNotificationSettingsSchema = z.object({
  body: z
    .object({
      telegramChatId: z.string().max(64).nullable(),
      downAlertDelayMinutes: z.number(),
      wirelessAlertsEnabled: z.boolean()
    })
    .strict()
});

export const sendTestNotificationSchema = z.object({
  body: z
    .object({
      telegramChatId: z.string().max(64).optional()
    })
    .strict()
    .optional()
});
