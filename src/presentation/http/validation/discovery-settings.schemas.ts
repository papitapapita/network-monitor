import { z } from 'zod';

// Shape only; the rules on each value live in DiscoverySettings (DEV-210).
export const updateDiscoverySettingsSchema = z.object({
  body: z
    .object({
      enabled: z.boolean(),
      intervalHours: z.number(),
      segments: z.array(
        z
          .object({
            cidr: z.string(),
            agentId: z.string().nullable()
          })
          .strict()
      )
    })
    .strict()
});
