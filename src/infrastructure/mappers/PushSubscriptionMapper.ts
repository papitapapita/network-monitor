import { PushSubscriptionId } from 'domain/shared/ids';
import { PushSubscription } from 'domain/notifications/entities';

type PrismaPushSubscriptionRecord = {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  createdAt: Date;
};

export class PushSubscriptionMapper {
  public static toDomain(
    raw: PrismaPushSubscriptionRecord
  ): PushSubscription {
    const idResult = PushSubscriptionId.parse(raw.id);
    if (idResult.isFailure) {
      throw new Error(
        `Data integrity violation: invalid id "${raw.id}" in push_subscriptions`
      );
    }

    return PushSubscription.reconstitute(idResult.value, {
      userId: raw.userId,
      endpoint: raw.endpoint,
      p256dh: raw.p256dh,
      auth: raw.auth,
      userAgent: raw.userAgent,
      createdAt: raw.createdAt
    });
  }

  public static toPersistence(
    entity: PushSubscription
  ): PrismaPushSubscriptionRecord {
    return {
      id: entity.id.toString(),
      userId: entity.userId,
      endpoint: entity.endpoint,
      p256dh: entity.p256dh,
      auth: entity.auth,
      userAgent: entity.userAgent,
      createdAt: entity.createdAt
    };
  }
}
