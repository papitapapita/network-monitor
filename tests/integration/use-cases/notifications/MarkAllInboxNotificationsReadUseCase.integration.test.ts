// Source: src/application/notifications/use-cases/MarkAllInboxNotificationsReadUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import { MarkAllInboxNotificationsReadUseCase } from 'application/notifications/use-cases/MarkAllInboxNotificationsReadUseCase';
import { PrismaInboxNotificationRepository } from 'infrastructure/persistence/PrismaInboxNotificationRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { cleanDatabase, createTestPrisma } from '../../helpers/db';
import { seedPushUser } from '../../helpers/pushSubscriptions';
import { seedInboxNotification } from '../../helpers/inboxNotifications';

describe('[NOT-263] MarkAllInboxNotificationsReadUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: MarkAllInboxNotificationsReadUseCase;
  let aliceId: string;
  let bobId: string;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new MarkAllInboxNotificationsReadUseCase(
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
    bobId = await seedPushUser(prisma, 'bob@example.local');
  });

  it('marks every unread notification of the caller', async () => {
    await seedInboxNotification(prisma, aliceId);
    await seedInboxNotification(prisma, aliceId);

    const result = await useCase.execute({ userId: aliceId });

    expect(result.value).toEqual({ marked: 2 });
    expect(
      await prisma.inboxNotification.count({
        where: { userId: aliceId, readAt: null }
      })
    ).toBe(0);
  });

  it('[NOT-262] keeps the read time of ones already read', async () => {
    const firstRead = new Date('2026-10-27T15:00:00Z');
    const id = await seedInboxNotification(prisma, aliceId, {
      readAt: firstRead
    });

    const result = await useCase.execute({ userId: aliceId });

    expect(result.value).toEqual({ marked: 0 });
    const row = await prisma.inboxNotification.findUniqueOrThrow({
      where: { id }
    });
    expect(row.readAt).toEqual(firstRead);
  });

  it('[NOT-260] leaves other users’ notifications unread', async () => {
    await seedInboxNotification(prisma, bobId);

    await useCase.execute({ userId: aliceId });

    expect(
      await prisma.inboxNotification.count({
        where: { userId: bobId, readAt: null }
      })
    ).toBe(1);
  });
});
