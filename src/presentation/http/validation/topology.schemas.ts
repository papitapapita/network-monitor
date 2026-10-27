import { z } from 'zod';

export const getDeviceDescendantsSchema = z.object({
  params: z.object({ deviceId: z.string().uuid() })
});

export type GetDeviceDescendantsInput = z.infer<
  typeof getDeviceDescendantsSchema
>;
