// Source: src/application/notifications/use-cases/SendPushAlertUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import { SendPushAlertUseCase } from 'application/notifications/use-cases/SendPushAlertUseCase';
import { SendPushAlertDTO } from 'application/notifications/dtos';
import { PrismaPushSubscriptionRepository } from 'infrastructure/persistence/PrismaPushSubscriptionRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { AlertSeverity } from 'domain/shared/enums';
import { cleanDatabase, createTestPrisma } from '../../helpers/db';
import { FakePushSender } from '../../helpers/FakePushSender';
import {
  seedPushSubscription,
  seedPushUser
} from '../../helpers/pushSubscriptions';

const ALERT: SendPushAlertDTO = {
  deviceId: 'd0b5c0de-0000-4000-8000-000000000001',
  severity: AlertSeverity.CRITICAL,
  summary: 'Torre Norte está caída',
  detail: null,
  resolved: false,
  type: 'device_unreachable'
};

describe('SendPushAlertUseCase — integration', () => {
  let prisma: PrismaClient;
  let sender: FakePushSender;
  let useCase: SendPushAlertUseCase;
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
    useCase = new SendPushAlertUseCase(
      new PrismaPushSubscriptionRepository(prisma),
      sender,
      new WinstonLogger()
    );
    aliceId = await seedPushUser(prisma, 'alice@example.local');
    bobId = await seedPushUser(prisma, 'bob@example.local', 'VIEWER');
  });

  it('[NOT-222] reaches every user’s phones, whatever their role', async () => {
    await seedPushSubscription(
      prisma,
      aliceId,
      'https://push.example.com/a'
    );
    await seedPushSubscription(
      prisma,
      bobId,
      'https://push.example.com/b'
    );

    const result = await useCase.execute(ALERT);

    expect(result.value).toEqual({ delivered: 2 });
    expect(sender.sent[0].payload).toMatchObject({
      title: '🔴 Torre Norte está caída',
      url: `/devices/${ALERT.deviceId}`
    });
  });

  it('[NOT-223] skips the phones of a disabled user', async () => {
    await seedPushSubscription(
      prisma,
      aliceId,
      'https://push.example.com/a'
    );
    await seedPushSubscription(
      prisma,
      bobId,
      'https://push.example.com/b'
    );
    await prisma.user.update({
      where: { id: bobId },
      data: { disabledAt: new Date() }
    });

    await useCase.execute(ALERT);

    expect(sender.sent.map((s) => s.target.endpoint)).toEqual([
      'https://push.example.com/a'
    ]);
  });

  it('[NOT-222] a failing phone keeps its subscription and does not stop the rest', async () => {
    await seedPushSubscription(
      prisma,
      aliceId,
      'https://push.example.com/a'
    );
    await seedPushSubscription(
      prisma,
      bobId,
      'https://push.example.com/b'
    );
    sender.failing.add('https://push.example.com/a');

    const result = await useCase.execute(ALERT);

    expect(result.value).toEqual({ delivered: 1 });
    expect(await prisma.pushSubscription.count()).toBe(2);
  });

  it('[NOT-224] forgets a phone the push service reports gone', async () => {
    await seedPushSubscription(
      prisma,
      aliceId,
      'https://push.example.com/a'
    );
    sender.gone.add('https://push.example.com/a');

    await useCase.execute(ALERT);

    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it('succeeds with no phone subscribed', async () => {
    const result = await useCase.execute(ALERT);

    expect(result.value).toEqual({ delivered: 0 });
  });
});
