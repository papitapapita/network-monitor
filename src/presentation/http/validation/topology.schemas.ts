import { z } from 'zod';

export const getDeviceDescendantsSchema = z.object({
  params: z.object({ deviceId: z.string().uuid() })
});

export type GetDeviceDescendantsInput = z.infer<
  typeof getDeviceDescendantsSchema
>;

export const listUpstreamSuggestionsSchema = z.object({
  query: z.object({ locationId: z.string().uuid().optional() })
});

export const acceptUpstreamSuggestionsSchema = z.object({
  body: z.object({
    links: z
      .array(
        z.object({
          deviceId: z.string().uuid(),
          upstreamDeviceId: z.string().uuid()
        })
      )
      .min(1)
      .max(500)
  })
});

export type ListUpstreamSuggestionsInput = z.infer<
  typeof listUpstreamSuggestionsSchema
>;
export type AcceptUpstreamSuggestionsInput = z.infer<
  typeof acceptUpstreamSuggestionsSchema
>;
