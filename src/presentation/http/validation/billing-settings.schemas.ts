import { z } from 'zod';

// Shape only; the rules on each value live in BillingSettings (BIL-280).
export const updateBillingSettingsSchema = z.object({
  body: z
    .object({
      automaticBillingEnabled: z.boolean(),
      billingMode: z.string(),
      issueLeadDays: z.number(),
      graceDays: z.number(),
      automaticCutEnabled: z.boolean()
    })
    .strict()
});
