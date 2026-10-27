// Source: src/application/notifications/use-cases/MarkInboxNotificationReadUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import {
  MarkInboxNotificationReadUseCase,
  INBOX_NOTIFICATION_NOT_FOUND
} from 'application/notifications/use-cases/MarkInboxNotificationReadUseCase';
import { PrismaInboxNotificationRepository } from 'infrastructure/persistence/PrismaInboxNotificationRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanDatabase,
  createTestPrisma,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';
import { seedPushUser } from '../../helpers/pushSubscriptions';
import { seedInboxNotification } from '../../helpers/inboxNotifications';

describe('MarkInboxNotificationReadUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: MarkInboxNotificationReadUseCase;
  let aliceId: string;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new MarkInboxNotificationReadUseCase(
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

  it('[NOT-262] stores when it was read', async () => {
    const id = await seedInboxNotification(prisma, aliceId);

    const result = await useCase.execute({ userId: aliceId, id });

    expect(result.isSuccess).toBe(true);
    const row = await prisma.inboxNotification.findUniqueOrThrow({
      where: { id }
    });
    expect(row.readAt).not.toBeNull();
    expect(result.value.readAt).toBe(row.readAt!.toISOString());
  });

  it('[NOT-262] keeps the first read time', async () => {
    const firstRead = new Date('2026-10-27T15:00:00Z');
    const id = await seedInboxNotification(prisma, aliceId, {
      readAt: firstRead
    });

    await useCase.execute({ userId: aliceId, id });

    const row = await prisma.inboxNotification.findUniqueOrThrow({
      where: { id }
    });
    expect(row.readAt).toEqual(firstRead);
  });

  it('[NOT-260] does not touch another user’s notification', async () => {
    const bobId = await seedPushUser(prisma, 'bob@example.local');
    const id = await seedInboxNotification(prisma, bobId);

    const result = await useCase.execute({ userId: aliceId, id });

    expect(result.error).toBe(INBOX_NOTIFICATION_NOT_FOUND);
    const row = await prisma.inboxNotification.findUniqueOrThrow({
      where: { id }
    });
    expect(row.readAt).toBeNull();
  });

  it('is not found for an id that does not exist', async () => {
    const result = await useCase.execute({
      userId: aliceId,
      id: GHOST_ID
    });

    expect(result.error).toBe(INBOX_NOTIFICATION_NOT_FOUND);
  });

  it('rejects a malformed id', async () => {
    const result = await useCase.execute({
      userId: aliceId,
      id: INVALID_ID
    });

    expect(result.error).toMatch(/^Invalid notification ID/);
  });
});
