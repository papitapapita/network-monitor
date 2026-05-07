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

export type ListAlertsQuery = z.infer<typeof listAlertsSchema>['query'];
