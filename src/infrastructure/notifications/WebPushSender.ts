import webpush, { WebPushError } from 'web-push';
import { Result } from 'domain/shared/core';
import {
  IPushSender,
  PushOutcome,
  PushPayload,
  PushTarget
} from 'application/notifications/interfaces';
import { WebPushConfig } from './config';

// An alert still undelivered after a day — the phone was off — is history,
// not news; the dashboard has it.
const TTL_SECONDS = 24 * 60 * 60;

export class WebPushSender implements IPushSender {
  constructor(private readonly config: WebPushConfig) {}

  async send(
    target: PushTarget,
    payload: PushPayload
  ): Promise<Result<PushOutcome>> {
    try {
      await webpush.sendNotification(
        {
          endpoint: target.endpoint,
          keys: { p256dh: target.p256dh, auth: target.auth }
        },
        JSON.stringify(payload),
        {
          vapidDetails: this.config,
          TTL: TTL_SECONDS,
          urgency: payload.urgent ? 'high' : 'normal',
          timeout: 10_000
        }
      );
      return Result.ok<PushOutcome>('delivered');
    } catch (error) {
      if (
        error instanceof WebPushError &&
        (error.statusCode === 404 || error.statusCode === 410)
      ) {
        return Result.ok<PushOutcome>('gone');
      }
      if (error instanceof WebPushError) {
        return Result.fail(
          `Push service error ${error.statusCode}: ${error.body || error.message}`
        );
      }
      return Result.fail(
        `Network error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
