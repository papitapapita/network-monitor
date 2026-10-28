import { z } from 'zod';

const uuidSchema = z.string().uuid();

// Which speeds a port can be expected at is the domain's rule (MON-142).
export const setPortExpectedSpeedSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    portName: z.string().trim().min(1).max(64),
    expectedMbps: z.number().int().positive().nullable(),
    alertOnNoLink: z.boolean().optional()
  })
});

export const getRouterPortSpeedsSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export const acceptCurrentPortSpeedsSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export type SetPortExpectedSpeedInput = z.infer<
  typeof setPortExpectedSpeedSchema
>;
