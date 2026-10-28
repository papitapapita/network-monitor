import { z } from 'zod';

export const getRouterSystemSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});
