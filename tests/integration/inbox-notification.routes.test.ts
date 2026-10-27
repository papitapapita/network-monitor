// Source: src/presentation/http/routes/inbox-notification.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import { cleanDatabase, GHOST_ID } from './helpers/db';
import { seedInboxNotification } from './helpers/inboxNotifications';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Inbox Notification Routes — /api/notifications', () => {
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

  const get = (path: string, token: string) =>
    request(app)
      .get(`/api/notifications${path}`)
      .set('Authorization', `Bearer ${token}`);

  const post = (path: string, token: string) =>
    request(app)
      .post(`/api/notifications${path}`)
      .set('Authorization', `Bearer ${token}`);

  describe('GET /api/notifications', () => {
    it('[NOT-260] 200 — a VIEWER sees only their own inbox', async () => {
      await seedInboxNotification(prisma, viewerId, { title: 'Mía' });
      await seedInboxNotification(prisma, adminId, {
        title: 'Ajena'
      });

      const res = await get('', viewerToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        total: 1,
        unread: 1,
        hasMore: false,
        limit: 20,
        offset: 0
      });
      expect(res.body.data.notifications).toHaveLength(1);
      expect(res.body.data.notifications[0]).toMatchObject({
        title: 'Mía',
        category: 'device',
        severity: 'CRITICAL',
        resolved: false,
        type: 'device_unreachable',
        body: null,
        deviceId: null,
        alertId: null,
        readAt: null
      });
    });

    it('[NOT-261] 200 — unread=true leaves read ones out', async () => {
      await seedInboxNotification(prisma, viewerId, {
        readAt: new Date()
      });
      await seedInboxNotification(prisma, viewerId, {
        title: 'Sin leer'
      });

      const res = await get('?unread=true&limit=5', viewerToken);

      expect(res.status).toBe(200);
      expect(
        res.body.data.notifications.map(
          (n: { title: string }) => n.title
        )
      ).toEqual(['Sin leer']);
      expect(res.body.data.limit).toBe(5);
    });

    it.each(['?limit=0', '?limit=101', '?offset=-1', '?unread=yes'])(
      '400 — rejects %s',
      async (query) => {
        const res = await get(query, viewerToken);
        expect(res.status).toBe(400);
      }
    );

    it('401 — rejects a request with no token', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('200 — returns the caller’s unread count', async () => {
      await seedInboxNotification(prisma, viewerId);
      await seedInboxNotification(prisma, viewerId);
      await seedInboxNotification(prisma, adminId);

      const res = await get('/unread-count', viewerToken);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { unread: 2 }
      });
    });

    it('401 — rejects a request with no token', async () => {
      const res = await request(app).get(
        '/api/notifications/unread-count'
      );
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/notifications/:id/read', () => {
    it('[NOT-262] 200 — marks the caller’s notification read', async () => {
      const id = await seedInboxNotification(prisma, viewerId);

      const res = await post(`/${id}/read`, viewerToken);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);
      expect(res.body.data.readAt).not.toBeNull();
    });

    it('[NOT-260] 404 — another user’s notification', async () => {
      const id = await seedInboxNotification(prisma, adminId);

      const res = await post(`/${id}/read`, viewerToken);

      expect(res.status).toBe(404);
      const row = await prisma.inboxNotification.findUniqueOrThrow({
        where: { id }
      });
      expect(row.readAt).toBeNull();
    });

    it('404 — a notification that does not exist', async () => {
      const res = await post(`/${GHOST_ID}/read`, viewerToken);
      expect(res.status).toBe(404);
    });

    it('400 — a malformed id', async () => {
      const res = await post('/not-a-uuid/read', viewerToken);
      expect(res.status).toBe(400);
    });

    it('401 — rejects a request with no token', async () => {
      const res = await request(app).post(
        `/api/notifications/${GHOST_ID}/read`
      );
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/notifications/read-all', () => {
    it('[NOT-263] 200 — marks only the caller’s unread notifications', async () => {
      await seedInboxNotification(prisma, viewerId);
      await seedInboxNotification(prisma, viewerId);
      await seedInboxNotification(prisma, adminId);

      const res = await post('/read-all', viewerToken);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { marked: 2 }
      });
      expect(
        await prisma.inboxNotification.count({
          where: { userId: adminId, readAt: null }
        })
      ).toBe(1);
    });

    it('401 — rejects a request with no token', async () => {
      const res = await request(app).post(
        '/api/notifications/read-all'
      );
      expect(res.status).toBe(401);
    });
  });
});
