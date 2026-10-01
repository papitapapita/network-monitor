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

export const listAgentOutagesSchema = z.object({
  params: agentIdParams,
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, 'limit must be a positive integer')
      .refine((v) => Number(v) >= 1 && Number(v) <= 100, {
        message: 'limit must be between 1 and 100'
      })
      .optional(),
    offset: z
      .string()
      .regex(/^\d+$/, 'offset must be a non-negative integer')
      .optional()
  })
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

// AGT-083: only a release binary's name; anything else never reaches the
// folder.
export const agentReleaseFileSchema = z.object({
  params: z.object({
    fileName: z
      .string()
      .regex(
        /^nms-agent-\d+\.\d+\.\d+-[a-z0-9]+-[a-z0-9]+\.gz$/,
        'Invalid release file name'
      )
  })
});
