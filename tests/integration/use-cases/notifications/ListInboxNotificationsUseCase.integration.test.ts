// Source: src/application/notifications/use-cases/ListInboxNotificationsUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import { ListInboxNotificationsUseCase } from 'application/notifications/use-cases/ListInboxNotificationsUseCase';
import { PrismaInboxNotificationRepository } from 'infrastructure/persistence/PrismaInboxNotificationRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { cleanDatabase, createTestPrisma } from '../../helpers/db';
import { seedPushUser } from '../../helpers/pushSubscriptions';
import { seedInboxNotification } from '../../helpers/inboxNotifications';

describe('ListInboxNotificationsUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: ListInboxNotificationsUseCase;
  let aliceId: string;
  let bobId: string;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new ListInboxNotificationsUseCase(
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

  it('[NOT-260] returns only the caller’s own notifications', async () => {
    await seedInboxNotification(prisma, aliceId, {
      title: 'De Alice'
    });
    await seedInboxNotification(prisma, bobId, { title: 'De Bob' });

    const result = await useCase.execute({ userId: aliceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.notifications.map((n) => n.title)).toEqual([
      'De Alice'
    ]);
    expect(result.value.total).toBe(1);
  });

  it('[NOT-261] lists newest first', async () => {
    await seedInboxNotification(prisma, aliceId, {
      title: 'Vieja',
      createdAt: new Date('2026-10-26T10:00:00Z')
    });
    await seedInboxNotification(prisma, aliceId, {
      title: 'Nueva',
      createdAt: new Date('2026-10-27T10:00:00Z')
    });

    const result = await useCase.execute({ userId: aliceId });

    expect(result.value.notifications.map((n) => n.title)).toEqual([
      'Nueva',
      'Vieja'
    ]);
  });

  it('[NOT-261] filters to unread and still reports the unread count', async () => {
    await seedInboxNotification(prisma, aliceId, {
      title: 'Leída',
      readAt: new Date()
    });
    await seedInboxNotification(prisma, aliceId, {
      title: 'Sin leer'
    });

    const result = await useCase.execute({
      userId: aliceId,
      unreadOnly: true
    });

    expect(result.value.notifications.map((n) => n.title)).toEqual([
      'Sin leer'
    ]);
    expect(result.value).toMatchObject({ total: 1, unread: 1 });
  });

  it('[NOT-261] pages without repeating rows', async () => {
    for (let i = 0; i < 5; i += 1) {
      await seedInboxNotification(prisma, aliceId);
    }

    const first = await useCase.execute({
      userId: aliceId,
      limit: 3
    });
    const second = await useCase.execute({
      userId: aliceId,
      limit: 3,
      offset: 3
    });

    expect(first.value).toMatchObject({ total: 5, hasMore: true });
    expect(second.value).toMatchObject({ total: 5, hasMore: false });
    const ids = [
      ...first.value.notifications,
      ...second.value.notifications
    ].map((n) => n.id);
    expect(new Set(ids).size).toBe(5);
  });

  it('returns an empty page for a user with no notifications', async () => {
    const result = await useCase.execute({ userId: aliceId });

    expect(result.value).toMatchObject({
      notifications: [],
      total: 0,
      unread: 0,
      hasMore: false
    });
  });
});
