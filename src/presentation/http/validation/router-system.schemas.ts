import { z } from 'zod';

export const getRouterSystemSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});

// MON-172: ranges are the domain's; this only checks shape.
export const updateRouterHealthThresholdsSchema = z.object({
  body: z
    .object({
      cpuPercent: z.number().int(),
      minFreeMemoryPercent: z.number().int(),
      minFreeDiskPercent: z.number().int(),
      maxTemperatureC: z.number().int(),
      minVoltage: z.number().nullable()
    })
    .strict()
});
