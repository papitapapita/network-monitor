// Source: src/application/notifications/use-cases/SubscribePushUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import { SubscribePushUseCase } from 'application/notifications/use-cases/SubscribePushUseCase';
import { PrismaPushSubscriptionRepository } from 'infrastructure/persistence/PrismaPushSubscriptionRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { cleanDatabase, createTestPrisma } from '../../helpers/db';
import {
  PUSH_KEYS,
  seedPushUser
} from '../../helpers/pushSubscriptions';

describe('SubscribePushUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: SubscribePushUseCase;
  let aliceId: string;
  let bobId: string;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new SubscribePushUseCase(
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

  it('[NOT-220] stores the phone for the user', async () => {
    const result = await useCase.execute({
      userId: aliceId,
      endpoint: 'https://push.example.com/phone-1',
      keys: PUSH_KEYS,
      userAgent: 'Android'
    });

    expect(result.isSuccess).toBe(true);
    const rows = await prisma.pushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: aliceId,
      endpoint: 'https://push.example.com/phone-1',
      userAgent: 'Android'
    });
  });

  it('[NOT-221] subscribing the same phone again keeps one row with the new keys', async () => {
    const endpoint = 'https://push.example.com/phone-1';
    await useCase.execute({
      userId: aliceId,
      endpoint,
      keys: PUSH_KEYS
    });
    await useCase.execute({
      userId: aliceId,
      endpoint,
      keys: { p256dh: 'BNewKey', auth: 'newAuth' }
    });

    const rows = await prisma.pushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].p256dh).toBe('BNewKey');
  });

  it('[NOT-221] another user signing in on the same phone takes it over', async () => {
    const endpoint = 'https://push.example.com/shared-phone';
    await useCase.execute({
      userId: aliceId,
      endpoint,
      keys: PUSH_KEYS
    });
    await useCase.execute({
      userId: bobId,
      endpoint,
      keys: PUSH_KEYS
    });

    const rows = await prisma.pushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(bobId);
  });

  it('[NOT-220] stores nothing for an endpoint that is not https', async () => {
    const result = await useCase.execute({
      userId: aliceId,
      endpoint: 'http://push.example.com/phone-1',
      keys: PUSH_KEYS
    });

    expect(result.error).toBe('endpoint must be an https URL');
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it('[NOT-223] deleting the user deletes their phones', async () => {
    await useCase.execute({
      userId: aliceId,
      endpoint: 'https://push.example.com/phone-1',
      keys: PUSH_KEYS
    });

    await prisma.user.delete({ where: { id: aliceId } });

    expect(await prisma.pushSubscription.count()).toBe(0);
  });
});
