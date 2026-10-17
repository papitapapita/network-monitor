import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const listSitePoePortsSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export const getDevicePowerSourceSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export type ListSitePoePortsInput = z.infer<
  typeof listSitePoePortsSchema
>;
export type GetDevicePowerSourceInput = z.infer<
  typeof getDevicePowerSourceSchema
>;
