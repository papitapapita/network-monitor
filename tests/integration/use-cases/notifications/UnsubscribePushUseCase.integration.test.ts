// Source: src/application/notifications/use-cases/UnsubscribePushUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import { UnsubscribePushUseCase } from 'application/notifications/use-cases/UnsubscribePushUseCase';
import { PrismaPushSubscriptionRepository } from 'infrastructure/persistence/PrismaPushSubscriptionRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { cleanDatabase, createTestPrisma } from '../../helpers/db';
import {
  seedPushSubscription,
  seedPushUser
} from '../../helpers/pushSubscriptions';

describe('[NOT-225] UnsubscribePushUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: UnsubscribePushUseCase;
  let aliceId: string;
  let bobId: string;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new UnsubscribePushUseCase(
      new PrismaPushSubscriptionRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    aliceId = await seedPushUser(prisma, 'alice@example.local');
    bobId = await seedPushUser(prisma, 'bob@example.local');
  });

  it('removes the user’s own phone', async () => {
    await seedPushSubscription(
      prisma,
      aliceId,
      'https://push.example.com/a'
    );

    const result = await useCase.execute({
      userId: aliceId,
      endpoint: 'https://push.example.com/a'
    });

    expect(result.isSuccess).toBe(true);
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it('leaves another user’s phone alone', async () => {
    await seedPushSubscription(
      prisma,
      bobId,
      'https://push.example.com/b'
    );

    const result = await useCase.execute({
      userId: aliceId,
      endpoint: 'https://push.example.com/b'
    });

    expect(result.isSuccess).toBe(true);
    expect(await prisma.pushSubscription.count()).toBe(1);
  });

  it('succeeds when the phone was never subscribed', async () => {
    const result = await useCase.execute({
      userId: aliceId,
      endpoint: 'https://push.example.com/never'
    });

    expect(result.isSuccess).toBe(true);
  });
});
