// Source: src/application/notifications/use-cases/GetUnreadInboxCountUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import { GetUnreadInboxCountUseCase } from 'application/notifications/use-cases/GetUnreadInboxCountUseCase';
import { PrismaInboxNotificationRepository } from 'infrastructure/persistence/PrismaInboxNotificationRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { cleanDatabase, createTestPrisma } from '../../helpers/db';
import { seedPushUser } from '../../helpers/pushSubscriptions';
import { seedInboxNotification } from '../../helpers/inboxNotifications';

describe('GetUnreadInboxCountUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: GetUnreadInboxCountUseCase;
  let aliceId: string;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new GetUnreadInboxCountUseCase(
      new PrismaInboxNotificationRepository(prisma),
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
  });

  it('[NOT-260] counts the caller’s unread notifications only', async () => {
    const bobId = await seedPushUser(prisma, 'bob@example.local');
    await seedInboxNotification(prisma, aliceId);
    await seedInboxNotification(prisma, aliceId, {
      readAt: new Date()
    });
    await seedInboxNotification(prisma, bobId);

    const result = await useCase.execute({ userId: aliceId });

    expect(result.value).toEqual({ unread: 1 });
  });

  it('is zero for an empty inbox', async () => {
    const result = await useCase.execute({ userId: aliceId });

    expect(result.value).toEqual({ unread: 0 });
  });
});
