import { z } from 'zod';

export const streamSpeedTestSchema = z.object({
  query: z
    .object({
      // EventSource cannot set an Authorization header (see wireless-stream)
      token: z.string().min(1).optional()
    })
    .optional()
});

export const listSpeedTestsSchema = z.object({
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      offset: z.coerce.number().int().min(0).optional()
    })
    .optional()
});
