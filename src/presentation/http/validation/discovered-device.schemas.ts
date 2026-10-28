import { z } from 'zod';

export const listDiscoveredDevicesSchema = z.object({
  query: z
    .object({ ignored: z.enum(['true', 'false']).optional() })
    .optional()
});

export const discoveredDeviceIdSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});
