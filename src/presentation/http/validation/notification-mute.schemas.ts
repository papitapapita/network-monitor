import { z } from 'zod';

const metricSchema = z
  .string()
  .trim()
  .min(1)
  .regex(
    /^[a-z][a-z0-9_]*$/,
    'must be lowercase letters, digits and underscores'
  );

export const replaceMutedAlertTypesSchema = z.object({
  body: z.object({
    metrics: z.array(metricSchema)
  })
});

export type ReplaceMutedAlertTypesInput = z.infer<
  typeof replaceMutedAlertTypesSchema
>;
