import { PrismaClient } from '../../../src/generated/prisma/client';

let sequence = 0;

/** Inserts an inbox notification for the user and returns its id. */
export async function seedInboxNotification(
  prisma: PrismaClient,
  userId: string,
  overrides: {
    title?: string;
    createdAt?: Date;
    readAt?: Date | null;
  } = {}
): Promise<string> {
  sequence += 1;
  const occurredAt = new Date(Date.UTC(2026, 9, 27, 0, sequence));
  const row = await prisma.inboxNotification.create({
    data: {
      userId,
      category: 'device',
      severity: 'CRITICAL',
      type: 'device_unreachable',
      title: overrides.title ?? `Notificación ${sequence}`,
      dedupKey: `device_unreachable|install|open|${occurredAt.toISOString()}`,
      occurredAt,
      readAt: overrides.readAt ?? null,
      ...(overrides.createdAt && { createdAt: overrides.createdAt })
    }
  });
  return row.id;
}
