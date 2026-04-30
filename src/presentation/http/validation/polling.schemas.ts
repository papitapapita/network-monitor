import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const pollDeviceSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export const getPollingStatusSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export const getPollingHistorySchema = z.object({
  params: z.object({ id: uuidSchema }),
  query: z.object({
    fromDate: z.string().datetime({ offset: true }).optional(),
    toDate: z.string().datetime({ offset: true }).optional(),
    status: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional(),
    offset: z.coerce.number().int().min(0).optional()
  }).optional()
});

export const configurePollingSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    intervalSeconds: z.number().int().min(1).max(86400).optional(),
    failuresBeforeDown: z.number().int().min(1).optional(),
    enabled: z.boolean().optional()
  }).refine(
    data => Object.keys(data).length > 0,
    { message: 'At least one field must be provided' }
  )
});

export const createDevicePollingSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    ipAddress: z.union([z.string().ipv4(), z.string().ipv6()]).nullable().optional(),
    intervalSeconds: z.number().int().min(1).max(86400).optional(),
    failuresBeforeDown: z.number().int().min(1).max(100).optional(),
    enabled: z.boolean().optional()
  }).optional()
});

export type PollDeviceInput = z.infer<typeof pollDeviceSchema>;
export type ConfigurePollingInput = z.infer<typeof configurePollingSchema>;
export type GetPollingHistoryInput = z.infer<typeof getPollingHistorySchema>;
export type CreateDevicePollingInput = z.infer<typeof createDevicePollingSchema>;
