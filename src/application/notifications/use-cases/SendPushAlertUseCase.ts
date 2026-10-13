import { Result } from 'domain/shared/core';
import { AlertSeverity } from 'domain/shared/enums';
import { IPushSubscriptionRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { SendPushAlertDTO } from '../dtos';
import { IPushSender } from '../interfaces';
import { PushDelivery } from '../shared';

// NOT-222: every subscribed phone gets the alert, as every member of the
// install's Telegram chat does.
export class SendPushAlertUseCase extends UseCase<
  SendPushAlertDTO,
  { delivered: number }
> {
  private readonly delivery: PushDelivery;

  constructor(
    private readonly repository: IPushSubscriptionRepository,
    sender: IPushSender,
    logger: ILogger
  ) {
    super(logger, 'SendPushAlertUseCase');
    this.delivery = new PushDelivery(repository, sender, this.logger);
  }

  protected async executeImpl(
    request: SendPushAlertDTO
  ): Promise<Result<{ delivered: number }>> {
    const subscriptions = await this.repository.listActive();
    if (subscriptions.isFailure) {
      return this.fail(
        `Failed to load push subscriptions: ${subscriptions.error}`
      );
    }
    if (subscriptions.value.length === 0)
      return this.ok({ delivered: 0 });

    const delivered = await this.delivery.deliver(
      subscriptions.value,
      {
        title: `${this.icon(request)} ${request.summary}`,
        body: request.detail?.trim() ?? '',
        url:
          request.deviceId !== null
            ? `/devices/${request.deviceId}`
            : '/alerts',
        // NOT-227: the recovery replaces the outage it ends.
        tag: `${request.type}:${request.deviceId ?? 'install'}`,
        urgent: !request.resolved
      }
    );
    return this.ok({ delivered });
  }

  private icon(request: SendPushAlertDTO): string {
    if (request.resolved) return '✅';
    return request.severity === AlertSeverity.CRITICAL ? '🔴' : '🟡';
  }
}
