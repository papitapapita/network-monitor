import { PushSubscription } from 'domain/notifications/entities';
import { IPushSubscriptionRepository } from 'domain/notifications/repository';
import { ILogger } from 'application/shared/interfaces';
import { IPushSender, PushPayload } from '../interfaces';

// Sends one payload to every given subscription at once. A phone that fails
// costs only its own copy (NOT-222); one the push service reports gone is
// forgotten so it is not tried again (NOT-224).
export class PushDelivery {
  constructor(
    private readonly repository: IPushSubscriptionRepository,
    private readonly sender: IPushSender,
    private readonly logger: ILogger
  ) {}

  async deliver(
    subscriptions: PushSubscription[],
    payload: PushPayload
  ): Promise<number> {
    const outcomes = await Promise.all(
      subscriptions.map((s) => this.deliverOne(s, payload))
    );
    return outcomes.filter(Boolean).length;
  }

  private async deliverOne(
    subscription: PushSubscription,
    payload: PushPayload
  ): Promise<boolean> {
    const sent = await this.sender.send(
      {
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth
      },
      payload
    );
    if (sent.isFailure) {
      this.logger.warn('Push notification not delivered', {
        userId: subscription.userId,
        error: sent.error
      });
      return false;
    }
    if (sent.value === 'gone') {
      await this.repository.deleteByEndpoint(subscription.endpoint);
      this.logger.info('Expired push subscription removed', {
        userId: subscription.userId
      });
      return false;
    }
    return true;
  }
}
