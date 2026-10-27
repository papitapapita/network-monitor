// Source: src/application/notifications/use-cases/RecordInboxNotificationUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import { RecordInboxNotificationUseCase } from 'application/notifications/use-cases/RecordInboxNotificationUseCase';
import { RecordInboxNotificationDTO } from 'application/notifications/dtos';
import { PrismaInboxNotificationRepository } from 'infrastructure/persistence/PrismaInboxNotificationRepository';
import { PrismaInboxRecipientsQuery } from 'infrastructure/persistence/PrismaInboxRecipientsQuery';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { SseBroadcaster } from 'infrastructure/realtime/SseBroadcaster';
import { InboxStream } from 'application/notifications/shared/InboxStream';
import { AlertSeverity } from 'domain/shared/enums';
import {
  cleanDatabase,
  createTestPrisma,
  seedDevice,
  seedDeviceModel
} from '../../helpers/db';
import { seedPushUser } from '../../helpers/pushSubscriptions';

const OCCURRED_AT = new Date('2026-10-27T14:00:00Z');

function makeRequest(
  overrides: Partial<RecordInboxNotificationDTO> = {}
): RecordInboxNotificationDTO {
  return {
    type: 'device_unreachable',
    severity: AlertSeverity.CRITICAL,
    resolved: false,
    title: 'AP Norte no responde desde las 14:00',
    body: 'También caídos: CPE Pérez',
    deviceId: null,
    alertId: null,
    occurredAt: OCCURRED_AT,
    ...overrides
  };
}

describe('[NOT-266] RecordInboxNotificationUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: RecordInboxNotificationUseCase;
  let hub: SseBroadcaster;
  let operatorId: string;
  let adminId: string;
  let vendorId: string;

  beforeAll(() => {
    prisma = createTestPrisma();
    const repository = new PrismaInboxNotificationRepository(prisma);
    const logger = new WinstonLogger();
    hub = new SseBroadcaster(logger);
    useCase = new RecordInboxNotificationUseCase(
      repository,
      new PrismaInboxRecipientsQuery(prisma),
      new InboxStream(hub, repository, logger),
      logger
    );
  });

  afterAll(async () => {
    hub.closeAll();
    await cleanDatabase(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    operatorId = await seedPushUser(prisma, 'operator@example.local');
    adminId = await seedPushUser(
      prisma,
      'admin@example.local',
      'ADMIN'
    );
    vendorId = await seedPushUser(
      prisma,
      'vendor@example.local',
      'VENDOR'
    );
  });

  async function inboxOwners(): Promise<string[]> {
    const rows = await prisma.inboxNotification.findMany({
      select: { userId: true }
    });
    return rows.map((row) => row.userId).sort();
  }

  it('gives every active account its own unread copy', async () => {
    const viewerId = await seedPushUser(
      prisma,
      'viewer@example.local',
      'VIEWER'
    );

    const result = await useCase.execute(makeRequest());

    expect(result.value).toEqual({ recorded: 4 });
    expect(await inboxOwners()).toEqual(
      [operatorId, adminId, vendorId, viewerId].sort()
    );
    const row = await prisma.inboxNotification.findFirstOrThrow({
      where: { userId: operatorId }
    });
    expect(row).toMatchObject({
      category: 'device',
      severity: 'CRITICAL',
      resolved: false,
      type: 'device_unreachable',
      title: 'AP Norte no responde desde las 14:00',
      body: 'También caídos: CPE Pérez',
      occurredAt: OCCURRED_AT,
      readAt: null
    });
  });

  it('leaves disabled accounts out', async () => {
    await prisma.user.update({
      where: { id: operatorId },
      data: { disabledAt: new Date() }
    });

    await useCase.execute(makeRequest());

    expect(await inboxOwners()).toEqual([adminId, vendorId].sort());
  });

  it('addresses a security notice to administrators only', async () => {
    const result = await useCase.execute(
      makeRequest({
        type: 'sign_in_paused',
        severity: AlertSeverity.WARNING,
        title: 'Inicio de sesión pausado para ana@example.local'
      })
    );

    expect(result.value).toEqual({ recorded: 2 });
    expect(await inboxOwners()).toEqual([adminId, vendorId].sort());
  });

  it('[NOT-267] records a retried delivery only once', async () => {
    await useCase.execute(makeRequest());
    await prisma.inboxNotification.updateMany({
      where: { userId: adminId },
      data: { readAt: new Date() }
    });

    const retry = await useCase.execute(makeRequest());

    expect(retry.value).toEqual({ recorded: 0 });
    expect(await prisma.inboxNotification.count()).toBe(3);
    expect(
      await prisma.inboxNotification.count({
        where: { userId: adminId, readAt: null }
      })
    ).toBe(0);
  });

  it('[NOT-267] records the recovery as its own notice', async () => {
    await useCase.execute(makeRequest());

    const result = await useCase.execute(
      makeRequest({
        resolved: true,
        title: 'AP Norte volvió a responder'
      })
    );

    expect(result.value).toEqual({ recorded: 3 });
    expect(await prisma.inboxNotification.count()).toBe(6);
  });

  it('records a later outage of the same device again', async () => {
    await useCase.execute(makeRequest());

    const result = await useCase.execute(
      makeRequest({ occurredAt: new Date('2026-10-27T18:00:00Z') })
    );

    expect(result.value).toEqual({ recorded: 3 });
  });

  it('links the notice to its device and alert, unlinking when they go', async () => {
    const deviceId = await seedDevice(
      prisma,
      await seedDeviceModel(prisma)
    );
    const alert = await prisma.alertEvent.create({
      data: { deviceId, type: 'device_unreachable' }
    });

    await useCase.execute(
      makeRequest({ deviceId, alertId: alert.id })
    );
    const linked = await prisma.inboxNotification.findFirstOrThrow({
      where: { userId: adminId }
    });
    expect(linked).toMatchObject({ deviceId, alertId: alert.id });

    await prisma.alertEvent.delete({ where: { id: alert.id } });

    const unlinked = await prisma.inboxNotification.findFirstOrThrow({
      where: { userId: adminId }
    });
    expect(unlinked.alertId).toBeNull();
    expect(unlinked.deviceId).toBe(deviceId);
  });

  it('[NOT-269] pushes the new notification to the recipient’s open streams', async () => {
    const frames: string[] = [];
    const unsubscribe = hub.subscribe(`inbox:user:${operatorId}`, {
      write: (frame: string) => frames.push(frame),
      end: () => undefined
    });

    await useCase.execute(makeRequest());
    await useCase.execute(makeRequest());
    unsubscribe();

    expect(frames).toHaveLength(1);
    expect(frames[0].startsWith('event: notification\ndata: ')).toBe(
      true
    );
    const payload = JSON.parse(
      frames[0].slice('event: notification\ndata: '.length)
    );
    expect(payload).toMatchObject({
      unread: 1,
      notification: {
        category: 'device',
        title: 'AP Norte no responde desde las 14:00',
        readAt: null
      }
    });
  });

  it('rejects an invalid notice without recording anything', async () => {
    const result = await useCase.execute(makeRequest({ title: ' ' }));

    expect(result.error).toBe('title is required');
    expect(await prisma.inboxNotification.count()).toBe(0);
  });
});
