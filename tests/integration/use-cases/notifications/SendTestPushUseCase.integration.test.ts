// Source: src/application/notifications/use-cases/SendTestPushUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import {
  SendTestPushUseCase,
  NO_PUSH_SUBSCRIPTION
} from 'application/notifications/use-cases/SendTestPushUseCase';
import { PrismaPushSubscriptionRepository } from 'infrastructure/persistence/PrismaPushSubscriptionRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { cleanDatabase, createTestPrisma } from '../../helpers/db';
import { FakePushSender } from '../../helpers/FakePushSender';
import {
  seedPushSubscription,
  seedPushUser
} from '../../helpers/pushSubscriptions';

describe('[NOT-226] SendTestPushUseCase — integration', () => {
  let prisma: PrismaClient;
  let sender: FakePushSender;
  let useCase: SendTestPushUseCase;
  let aliceId: string;
  let bobId: string;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    sender = new FakePushSender();
    useCase = new SendTestPushUseCase(
      new PrismaPushSubscriptionRepository(prisma),
      sender,
      new WinstonLogger()
    );
    aliceId = await seedPushUser(prisma, 'alice@example.local');
    bobId = await seedPushUser(prisma, 'bob@example.local');
  });

  it('reaches only the caller’s own phones', async () => {
    await seedPushSubscription(
      prisma,
      aliceId,
      'https://push.example.com/a1'
    );
    await seedPushSubscription(
      prisma,
      aliceId,
      'https://push.example.com/a2'
    );
    await seedPushSubscription(
      prisma,
      bobId,
      'https://push.example.com/b'
    );

    const result = await useCase.execute({ userId: aliceId });

    expect(result.value).toEqual({ delivered: 2 });
    expect(sender.sent.map((s) => s.target.endpoint).sort()).toEqual([
      'https://push.example.com/a1',
      'https://push.example.com/a2'
    ]);
  });

  it('fails when the caller has no phone subscribed', async () => {
    await seedPushSubscription(
      prisma,
      bobId,
      'https://push.example.com/b'
    );

    const result = await useCase.execute({ userId: aliceId });

    expect(result.error).toBe(NO_PUSH_SUBSCRIPTION);
    expect(sender.sent).toHaveLength(0);
  });

  it('[NOT-224] forgets a phone the push service reports gone', async () => {
    await seedPushSubscription(
      prisma,
      aliceId,
      'https://push.example.com/a1'
    );
    await seedPushSubscription(
      prisma,
      aliceId,
      'https://push.example.com/a2'
    );
    sender.gone.add('https://push.example.com/a1');

    const result = await useCase.execute({ userId: aliceId });

    expect(result.value).toEqual({ delivered: 1 });
    const left = await prisma.pushSubscription.findMany();
    expect(left.map((r) => r.endpoint)).toEqual([
      'https://push.example.com/a2'
    ]);
  });
});
