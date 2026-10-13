import { Result } from 'domain/shared/core';

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// What the service worker turns into a notification. `url` is a path on the
// dashboard's own origin; a later message with the same `tag` replaces the
// earlier one on the phone instead of stacking under it.
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  urgent: boolean;
}

// `gone`: the push service says the browser unsubscribed or the subscription
// expired — it will never be reachable again (NOT-224).
export type PushOutcome = 'delivered' | 'gone';

export interface IPushSender {
  send(
    target: PushTarget,
    payload: PushPayload
  ): Promise<Result<PushOutcome>>;
}
