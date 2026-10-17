import { z } from 'zod';
import { DEVICE_CATEGORIES } from './device.schemas';

export const streamNetworkSweepSchema = z.object({
  query: z
    .object({
      // EventSource cannot set an Authorization header (see wireless-stream)
      token: z.string().min(1).optional(),
      locationId: z
        .string()
        .uuid('locationId must be a valid UUID')
        .optional(),
      category: z
        .enum(DEVICE_CATEGORIES, {
          error: () => ({
            message: `category must be one of: ${DEVICE_CATEGORIES.join(', ')}`
          })
        })
        .optional()
    })
    .optional()
});

export type StreamNetworkSweepInput = z.infer<
  typeof streamNetworkSweepSchema
>;
