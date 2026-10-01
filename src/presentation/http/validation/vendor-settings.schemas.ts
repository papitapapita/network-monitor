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
      wirelessAlertRecordRetentionDays: z.number(),
      issuer: z
        .object({
          name: z.string(),
          documentLabel: z.string(),
          document: z.string(),
          address: z.string(),
          city: z.string(),
          contactPhone: z.string(),
          contactEmail: z.string(),
          accentColorHex: z.string()
        })
        .strict()
        .nullable(),
      whatsApp: z
        .object({
          phoneNumberId: z.string(),
          templateName: z.string(),
          templateLanguage: z.string(),
          apiVersion: z.string()
        })
        .strict()
        .nullable(),
      enforcementRouter: z
        .object({ deviceId: z.string(), apiPort: z.number() })
        .strict()
        .nullable()
    })
    .strict()
});
