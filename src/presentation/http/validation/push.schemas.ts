import { z } from 'zod';

const keySchema = z.string().trim().min(1).max(255);

// The shape of the browser's PushSubscription.toJSON(), sent as is.
export const subscribePushSchema = z.object({
  body: z.object({
    endpoint: z.string().trim().url().max(2048),
    keys: z.object({ p256dh: keySchema, auth: keySchema })
  })
});

export const unsubscribePushSchema = z.object({
  body: z.object({
    endpoint: z.string().trim().min(1).max(2048)
  })
});

export type SubscribePushInput = z.infer<typeof subscribePushSchema>;
