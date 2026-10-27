import { z } from 'zod';

export const streamPingToolSchema = z.object({
  query: z.object({
    // EventSource cannot set an Authorization header (see wireless-stream)
    token: z.string().min(1).optional(),
    ip: z.union([z.ipv4(), z.ipv6()], {
      error: () => ({
        message: 'ip must be a valid IPv4 or IPv6 address'
      })
    }),
    agentId: z
      .string()
      .uuid('agentId must be a valid UUID')
      .optional(),
    count: z.coerce.number().int().min(1).max(100).optional()
  })
});
