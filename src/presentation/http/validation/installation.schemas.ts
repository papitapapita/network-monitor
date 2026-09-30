import { z } from 'zod';

// A bare file name: the folder's own listing decides what exists, this only
// turns away what can never be one of its entries.
export const installerFileNameSchema = z.object({
  params: z.object({
    fileName: z
      .string()
      .min(1)
      .max(255)
      .refine(
        (name) => !/[/\\]/.test(name) && !name.startsWith('.'),
        {
          message: 'Invalid installer file name'
        }
      )
  })
});
