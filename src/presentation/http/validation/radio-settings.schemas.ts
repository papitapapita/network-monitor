import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const revealWirelessKeySchema = z.object({
  params: z.object({ id: uuidSchema })
});

// The name's own rules (WLS-223) are the domain's; this only keeps out what
// is not a name at all.
export const renameRadioSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({ hostname: z.string().max(255) })
});
