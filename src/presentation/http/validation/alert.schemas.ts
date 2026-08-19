import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const listAlertsSchema = z.object({
  query: z
    .object({
      deviceId: uuidSchema.optional(),
      limit: z.coerce.number().int().min(1).max(300).optional(),
      offset: z.coerce.number().int().min(0).optional()
    })
    .optional()
});

export type ListAlertsQuery = z.infer<
  typeof listAlertsSchema
>['query'];

export const getAlertByIdSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export const deleteAlertSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export const clearAlertSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export const bulkClearAlertsSchema = z.object({
  body: z
    .object({
      ids: z.array(uuidSchema).min(1).optional(),
      deviceId: uuidSchema.optional()
    })
    .refine(
      (data) => (data.ids ? 1 : 0) + (data.deviceId ? 1 : 0) === 1,
      {
        message: 'Provide exactly one of ids or deviceId'
      }
    )
});

export const bulkDeleteAlertsSchema = z.object({
  body: z.object({
    ids: z.array(uuidSchema).min(1)
  })
});
