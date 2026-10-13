import { Result } from 'domain/shared/core';
import { PushSubscription } from 'domain/notifications/entities';
import { IPushSubscriptionRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  PushSubscriptionResponseDTO,
  SubscribePushDTO
} from '../dtos';

// NOT-220, NOT-221: the signed-in user's phone starts receiving alerts.
export class SubscribePushUseCase extends UseCase<
  SubscribePushDTO,
  PushSubscriptionResponseDTO
> {
  constructor(
    private readonly repository: IPushSubscriptionRepository,
    logger: ILogger
  ) {
    super(logger, 'SubscribePushUseCase');
  }

  protected async executeImpl(
    request: SubscribePushDTO
  ): Promise<Result<PushSubscriptionResponseDTO>> {
    const subscription = PushSubscription.create({
      userId: request.userId,
      endpoint: request.endpoint,
      p256dh: request.keys?.p256dh,
      auth: request.keys?.auth,
      userAgent: request.userAgent
    });
    if (subscription.isFailure) return this.fail(subscription.error);

    const saved = await this.repository.save(subscription.value);
    if (saved.isFailure) {
      return this.fail(
        `Failed to save push subscription: ${saved.error}`
      );
    }

    return this.ok({
      endpoint: saved.value.endpoint,
      userAgent: saved.value.userAgent,
      createdAt: saved.value.createdAt.toISOString()
    });
  }

  // The keys let anyone encrypt messages to that phone.
  protected sanitizeForLogging(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;
    const { keys: _keys, ...rest } = data as SubscribePushDTO;
    return rest;
  }
}
