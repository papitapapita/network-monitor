import { z } from 'zod';
import { RadioAntennaType } from '../../../generated/prisma/client';

export const LinkAntennaSchema = z.object({
  networkDeviceId: z.number().int().positive(),
  power: z.number().optional(),
  antennaGain: z.number().optional(),
  height: z.number().optional(),
  frequencyRange: z.string().optional(),
  type: z.enum(Object.values(RadioAntennaType))
});

export type LinkAntennaDTO = z.infer<typeof LinkAntennaSchema>;
