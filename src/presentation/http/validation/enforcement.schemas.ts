import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const getServiceEnforcementSchema = z.object({
  params: z.object({
    id: z.string().regex(UUID_REGEX, 'Invalid id (must be a UUID v4)')
  })
});

export type GetServiceEnforcementInput = z.infer<
  typeof getServiceEnforcementSchema
>;
