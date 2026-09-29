import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const agentIdParams = z.object({
  id: z
    .string()
    .regex(UUID_REGEX, 'Invalid agent ID (must be a UUID v4)')
});

export const createAgentSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'name is required').max(60)
  })
});

export const agentIdParamSchema = z.object({
  params: agentIdParams
});

export const enrollAgentSchema = z.object({
  body: z.object({
    pairingCode: z
      .string()
      .trim()
      .min(1, 'pairingCode is required')
      .max(128)
  })
});
