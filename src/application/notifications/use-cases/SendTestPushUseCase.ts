import { Result } from 'domain/shared/core';
import { IPushSubscriptionRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { SendTestPushDTO, SendTestPushResponseDTO } from '../dtos';
import { IPushSender } from '../interfaces';
import { PushDelivery } from '../shared';

export const NO_PUSH_SUBSCRIPTION =
  'This user has no phone subscribed to notifications';
export const TEST_PUSH_NOT_DELIVERED =
  'Test notification not delivered to any phone';

// NOT-226: the user sees a notification arrive on their own phones before
// relying on it. Other users' phones are left alone.
export class SendTestPushUseCase extends UseCase<
  SendTestPushDTO,
  SendTestPushResponseDTO
> {
  private readonly delivery: PushDelivery;

  constructor(
    private readonly repository: IPushSubscriptionRepository,
    sender: IPushSender,
    logger: ILogger
  ) {
    super(logger, 'SendTestPushUseCase');
    this.delivery = new PushDelivery(repository, sender, this.logger);
  }

  protected async executeImpl(
    request: SendTestPushDTO
  ): Promise<Result<SendTestPushResponseDTO>> {
    const subscriptions = await this.repository.listByUser(
      request.userId
    );
    if (subscriptions.isFailure) {
      return this.fail(
        `Failed to load push subscriptions: ${subscriptions.error}`
      );
    }
    if (subscriptions.value.length === 0) {
      return this.fail(NO_PUSH_SUBSCRIPTION);
    }

    const delivered = await this.delivery.deliver(
      subscriptions.value,
      {
        title: '✅ Notificación de prueba',
        body: 'Las alertas de la red llegarán a este teléfono.',
        url: '/alerts',
        tag: 'test',
        urgent: false
      }
    );
    if (delivered === 0) return this.fail(TEST_PUSH_NOT_DELIVERED);
    return this.ok({ delivered });
  }
}
