// Source: src/application/notifications/use-cases/PurgeOldInboxNotificationsUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import { PurgeOldInboxNotificationsUseCase } from 'application/notifications/use-cases/PurgeOldInboxNotificationsUseCase';
import { PrismaInboxNotificationRepository } from 'infrastructure/persistence/PrismaInboxNotificationRepository';
import { cleanDatabase, createTestPrisma } from '../../helpers/db';
import { seedPushUser } from '../../helpers/pushSubscriptions';
import { seedInboxNotification } from '../../helpers/inboxNotifications';

const NOW = new Date('2026-10-27T12:00:00Z');
const DAY = 86_400_000;

describe('[NOT-268] PurgeOldInboxNotificationsUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: PurgeOldInboxNotificationsUseCase;
  let aliceId: string;
  let bobId: string;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new PurgeOldInboxNotificationsUseCase(
      new PrismaInboxNotificationRepository(prisma)
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

  it('deletes every user’s notifications older than 90 days, read or not', async () => {
    await seedInboxNotification(prisma, aliceId, {
      createdAt: new Date(NOW.getTime() - 91 * DAY)
    });
    await seedInboxNotification(prisma, bobId, {
      createdAt: new Date(NOW.getTime() - 120 * DAY),
      readAt: new Date(NOW.getTime() - 119 * DAY)
    });

    const result = await useCase.execute(NOW);

    expect(result.value).toBe(2);
    expect(await prisma.inboxNotification.count()).toBe(0);
  });

  it('keeps notifications up to 90 days old, even unread', async () => {
    const recent = await seedInboxNotification(prisma, aliceId, {
      createdAt: new Date(NOW.getTime() - 89 * DAY)
    });
    const edge = await seedInboxNotification(prisma, bobId, {
      createdAt: new Date(NOW.getTime() - 90 * DAY)
    });

    const result = await useCase.execute(NOW);

    expect(result.value).toBe(0);
    const left = await prisma.inboxNotification.findMany({
      select: { id: true }
    });
    expect(left.map((row) => row.id).sort()).toEqual(
      [recent, edge].sort()
    );
  });

  it('deletes nothing from an empty inbox', async () => {
    const result = await useCase.execute(NOW);

    expect(result.value).toBe(0);
  });
});
