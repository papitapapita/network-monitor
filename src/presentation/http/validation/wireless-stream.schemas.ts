import { z } from 'zod';

const uuidSchema = z.string().uuid();

// EventSource cannot set an Authorization header, so the token may ride the
// query string instead — createStreamAuthenticateMiddleware accepts either.
const streamQueryFields = {
  token: z.string().min(1).optional()
};

export const streamDeviceThroughputSchema = z.object({
  params: z.object({ id: uuidSchema }),
  query: z.object(streamQueryFields).optional()
});

export const streamFleetThroughputSchema = z.object({
  query: z.object(streamQueryFields).optional()
});

export type StreamDeviceThroughputInput = z.infer<
  typeof streamDeviceThroughputSchema
>;
export type StreamFleetThroughputInput = z.infer<
  typeof streamFleetThroughputSchema
>;
