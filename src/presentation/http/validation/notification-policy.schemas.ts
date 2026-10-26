import { z } from 'zod';

const uuidSchema = z.string().uuid();
const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'must be HH:mm 24-hour time');

const policyFieldsSchema = z
  .object({
    quietHoursMode: z
      .enum(['INHERIT', 'CUSTOM', 'ALWAYS_NOTIFY'])
      .optional(),
    quietHoursStart: timeOfDaySchema.nullable().optional(),
    quietHoursEnd: timeOfDaySchema.nullable().optional(),
    alertDelayMinutes: z.number().int().min(0).nullable().optional()
  })
  .refine(
    (data) => {
      const startIsNull = (data.quietHoursStart ?? null) === null;
      const endIsNull = (data.quietHoursEnd ?? null) === null;
      return startIsNull === endIsNull;
    },
    {
      message:
        'quietHoursStart and quietHoursEnd must both be set, or both be null'
    }
  )
  .refine(
    (data) => {
      if (data.quietHoursMode === undefined) return true;
      const hasWindow = (data.quietHoursStart ?? null) !== null;
      return (data.quietHoursMode === 'CUSTOM') === hasWindow;
    },
    {
      message:
        'quietHoursStart and quietHoursEnd must be set when quietHoursMode is CUSTOM, and only then'
    }
  );

export const getDeviceNotificationPolicySchema = z.object({
  params: z.object({ id: uuidSchema })
});

export const upsertDeviceNotificationPolicySchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: policyFieldsSchema
});

export const deleteDeviceNotificationPolicySchema = z.object({
  params: z.object({ id: uuidSchema })
});

export const bulkUpsertDeviceNotificationPoliciesSchema = z.object({
  body: z
    .object({
      deviceIds: z.array(uuidSchema).min(1)
    })
    .and(policyFieldsSchema)
});

export type UpsertDeviceNotificationPolicyInput = z.infer<
  typeof upsertDeviceNotificationPolicySchema
>;
export type BulkUpsertDeviceNotificationPoliciesInput = z.infer<
  typeof bulkUpsertDeviceNotificationPoliciesSchema
>;
