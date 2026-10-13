import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { PushSubscription } from 'domain/notifications/entities';
import { IPushSubscriptionRepository } from 'domain/notifications/repository';
import { PushSubscriptionMapper } from '../mappers';

export class PrismaPushSubscriptionRepository
  implements IPushSubscriptionRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async save(
    subscription: PushSubscription
  ): Promise<Result<PushSubscription>> {
    try {
      const { id, endpoint, ...rest } =
        PushSubscriptionMapper.toPersistence(subscription);
      const record = await this.prisma.pushSubscription.upsert({
        where: { endpoint },
        create: { id, endpoint, ...rest },
        update: {
          userId: rest.userId,
          p256dh: rest.p256dh,
          auth: rest.auth,
          userAgent: rest.userAgent
        }
      });
      return Result.ok(PushSubscriptionMapper.toDomain(record));
    } catch (error) {
      return Result.fail(
        `Database error saving push subscription: ${(error as Error).message}`
      );
    }
  }

  async listActive(): Promise<Result<PushSubscription[]>> {
    try {
      const records = await this.prisma.pushSubscription.findMany({
        where: { user: { disabledAt: null } }
      });
      return Result.ok(records.map(PushSubscriptionMapper.toDomain));
    } catch (error) {
      return Result.fail(
        `Database error listing push subscriptions: ${(error as Error).message}`
      );
    }
  }

  async listByUser(
    userId: string
  ): Promise<Result<PushSubscription[]>> {
    try {
      const records = await this.prisma.pushSubscription.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' }
      });
      return Result.ok(records.map(PushSubscriptionMapper.toDomain));
    } catch (error) {
      return Result.fail(
        `Database error listing push subscriptions: ${(error as Error).message}`
      );
    }
  }

  async deleteByEndpoint(
    endpoint: string,
    userId?: string
  ): Promise<Result<boolean>> {
    try {
      const { count } = await this.prisma.pushSubscription.deleteMany(
        {
          where: { endpoint, ...(userId !== undefined && { userId }) }
        }
      );
      return Result.ok(count > 0);
    } catch (error) {
      return Result.fail(
        `Database error removing push subscription: ${(error as Error).message}`
      );
    }
  }
}
