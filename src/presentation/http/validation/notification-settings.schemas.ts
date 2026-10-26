import { z } from 'zod';

const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'must be HH:mm 24-hour time');

// Shape only; the rules on each value live in NotificationSettings (NOT-200).
export const updateNotificationSettingsSchema = z.object({
  body: z
    .object({
      telegramChatId: z.string().max(64).nullable(),
      downAlertDelayMinutes: z.number(),
      wirelessAlertsEnabled: z.boolean(),
      alertTicketMode: z.string().max(16).optional(),
      quietHoursStart: timeOfDaySchema.nullable().optional(),
      quietHoursEnd: timeOfDaySchema.nullable().optional()
    })
    .strict()
    .refine(
      (data) =>
        (data.quietHoursStart === undefined) ===
        (data.quietHoursEnd === undefined),
      {
        message:
          'quietHoursStart and quietHoursEnd must be sent together'
      }
    )
    .refine(
      (data) =>
        ((data.quietHoursStart ?? null) === null) ===
        ((data.quietHoursEnd ?? null) === null),
      {
        message:
          'quietHoursStart and quietHoursEnd must both be set, or both be null'
      }
    )
});

export const sendTestNotificationSchema = z.object({
  body: z
    .object({
      telegramChatId: z.string().max(64).optional()
    })
    .strict()
    .optional()
});
