// Source: src/presentation/http/routes/notification-mute.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import { cleanDatabase } from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Notification Mute Routes — /api/notification-mutes', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  describe('GET /api/notification-mutes', () => {
    it('[NOT-190] 200 — returns an empty list when nothing is muted', async () => {
      const res = await request(app)
        .get('/api/notification-mutes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ metrics: [] });
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app).get(
        '/api/notification-mutes'
      );
      expect(res.status).toBe(401);
    });

    it('200 — a VIEWER can read the mute list', async () => {
      const res = await request(app)
        .get('/api/notification-mutes')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/notification-mutes', () => {
    it('[NOT-190] 200 — replaces the muted metric list', async () => {
      const res = await request(app)
        .put('/api/notification-mutes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ metrics: ['cpu_load_percent', 'distance_m'] });

      expect(res.status).toBe(200);
      expect(res.body.metrics.sort()).toEqual([
        'cpu_load_percent',
        'distance_m'
      ]);
    });

    it('200 — the replaced list is visible on a subsequent GET', async () => {
      await request(app)
        .put('/api/notification-mutes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ metrics: ['cpu_load_percent'] });

      const res = await request(app)
        .get('/api/notification-mutes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.metrics).toEqual(['cpu_load_percent']);
    });

    it('200 — a second PUT fully replaces the first, not merges', async () => {
      await request(app)
        .put('/api/notification-mutes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ metrics: ['cpu_load_percent'] });

      const res = await request(app)
        .put('/api/notification-mutes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ metrics: ['distance_m'] });

      expect(res.status).toBe(200);
      expect(res.body.metrics).toEqual(['distance_m']);
    });

    it('200 — an empty array clears every mute', async () => {
      await request(app)
        .put('/api/notification-mutes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ metrics: ['cpu_load_percent'] });

      const res = await request(app)
        .put('/api/notification-mutes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ metrics: [] });

      expect(res.status).toBe(200);
      expect(res.body.metrics).toEqual([]);
    });

    it('[NOT-190] 403 — rejects a VIEWER', async () => {
      const res = await request(app)
        .put('/api/notification-mutes')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ metrics: ['cpu_load_percent'] });

      expect(res.status).toBe(403);
    });

    it('400 — rejects a malformed metric name', async () => {
      const res = await request(app)
        .put('/api/notification-mutes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ metrics: ['Not Valid!'] });

      expect(res.status).toBe(400);
    });

    it('400 — rejects a non-array metrics field', async () => {
      const res = await request(app)
        .put('/api/notification-mutes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ metrics: 'cpu_load_percent' });

      expect(res.status).toBe(400);
    });
  });
});
