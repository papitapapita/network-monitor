import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const listDeviceModelsSchema = z.object({
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, 'Limit must be a positive integer')
      .transform(Number)
      .refine((n) => n > 0 && n <= 100, {
        message: 'Limit must be between 1 and 100'
      })
      .optional(),

    offset: z
      .string()
      .regex(/^\d+$/, 'Offset must be a non-negative integer')
      .transform(Number)
      .refine((n) => n >= 0, {
        message: 'Offset must be non-negative'
      })
      .optional()
  })
});

export const getDeviceModelByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid device model ID (must be a UUID v4)')
  })
});

export type ListDeviceModelsQuery = z.infer<
  typeof listDeviceModelsSchema
>['query'];
export type GetDeviceModelByIdParams = z.infer<
  typeof getDeviceModelByIdSchema
>['params'];
