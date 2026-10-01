import { z } from 'zod';

// Shape only; the rules on each value live in VendorSettings (INS-028).
export const updateVendorSettingsSchema = z.object({
  body: z
    .object({
      vendorTelegramChatId: z.string().max(64).nullable(),
      subscriptionPaidUntil: z.string().max(10).nullable(),
      subscriptionGraceDays: z.number(),
      subscriptionReadOnlyDays: z.number(),
      pingResultRetentionDays: z.number(),
      alertRetentionDays: z.number(),
      wirelessSnapshotRetentionDays: z.number(),
      wirelessAlertRecordRetentionDays: z.number()
    })
    .strict()
});
