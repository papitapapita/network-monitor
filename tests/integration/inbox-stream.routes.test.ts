// Source: src/presentation/http/routes/inbox-stream.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import { cleanDatabase } from './helpers/db';
import { seedInboxNotification } from './helpers/inboxNotifications';
import { readSseStream } from './helpers/sse';
import { DependencyContainer } from '../../src/infrastructure/di/container';

const PATH = '/api/notifications/stream';

describe('Inbox stream routes', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let viewerToken: string;
  let viewerId: string;
  let adminId: string;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    container.eventStreamHub.closeAll();
    await cleanDatabase(prisma);
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
    await seedAndGetToken(app, prisma, 'ADMIN');
    viewerId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'viewer-test@example.local' }
      })
    ).id;
    adminId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'admin-test@example.local' }
      })
    ).id;
  });

  async function waitForSubscriber(userId: string): Promise<void> {
    const channel = `inbox:user:${userId}`;
    for (let i = 0; i < 100; i++) {
      if (container.eventStreamHub.clientCount(channel) > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('stream never subscribed');
  }

  describe(`GET ${PATH}`, () => {
    it('[NOT-265] 200 — opens with the caller’s own unread count', async () => {
      await seedInboxNotification(prisma, viewerId);
      await seedInboxNotification(prisma, viewerId);
      await seedInboxNotification(prisma, viewerId, {
        readAt: new Date()
      });
      await seedInboxNotification(prisma, adminId);

      const res = await readSseStream(app, PATH, {
        token: viewerToken
      });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(
        'text/event-stream'
      );
      expect(res.events).toEqual([
        { event: 'unread', data: { unread: 2 } }
      ]);
    });

    it('accepts a Bearer header as well as ?token=', async () => {
      const res = await readSseStream(app, PATH, {
        token: viewerToken,
        bearer: true
      });

      expect(res.status).toBe(200);
      expect(res.events[0]).toEqual({
        event: 'unread',
        data: { unread: 0 }
      });
    });

    it('[NOT-265] pushes the new count when the user reads from another tab', async () => {
      await seedInboxNotification(prisma, viewerId);
      await seedInboxNotification(prisma, viewerId);

      const streaming = readSseStream(app, PATH, {
        token: viewerToken,
        expectEvents: 2
      });
      await waitForSubscriber(viewerId);
      await request(app)
        .post('/api/notifications/read-all')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      const res = await streaming;

      expect(res.events).toEqual([
        { event: 'unread', data: { unread: 2 } },
        { event: 'unread', data: { unread: 0 } }
      ]);
    });

    it('401 — rejects a request with no credentials', async () => {
      const res = await readSseStream(app, PATH);

      expect(res.status).toBe(401);
    });

    it('401 — rejects an invalid token', async () => {
      const res = await readSseStream(app, PATH, {
        token: 'not-a-jwt'
      });

      expect(res.status).toBe(401);
    });
  });
});
