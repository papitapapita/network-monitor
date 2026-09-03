// Source: src/presentation/http/routes/notification-policy.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import {
  cleanDatabase,
  seedDeviceModel,
  seedDevice,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Notification Policy Routes — /api/devices/:id/notification-policy', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adminToken: string;
  let viewerToken: string;
  let deviceModelId: string;
  let deviceId: string;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    deviceId = await seedDevice(prisma, deviceModelId);
  });

  describe('GET /api/devices/:id/notification-policy', () => {
    it('[NOT-177] 200 — returns always-notify defaults when no policy exists', async () => {
      const res = await request(app)
        .get(`/api/devices/${deviceId}/notification-policy`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        deviceId,
        quietHoursStart: null,
        quietHoursEnd: null,
        alertDelayMinutes: null
      });
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app).get(
        `/api/devices/${deviceId}/notification-policy`
      );
      expect(res.status).toBe(401);
    });

    it('404 — device does not exist', async () => {
      const res = await request(app)
        .get(`/api/devices/${GHOST_ID}/notification-policy`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('400 — invalid device UUID', async () => {
      const res = await request(app)
        .get(`/api/devices/${INVALID_ID}/notification-policy`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/devices/:id/notification-policy', () => {
    it('200 — sets a quiet-hours window and delay override', async () => {
      const res = await request(app)
        .put(`/api/devices/${deviceId}/notification-policy`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          alertDelayMinutes: 10
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        deviceId,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        alertDelayMinutes: 10
      });
    });

    it('200 — the window is visible on a subsequent GET', async () => {
      await request(app)
        .put(`/api/devices/${deviceId}/notification-policy`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quietHoursStart: '20:00', quietHoursEnd: '06:00' });

      const res = await request(app)
        .get(`/api/devices/${deviceId}/notification-policy`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.quietHoursStart).toBe('20:00');
      expect(res.body.quietHoursEnd).toBe('06:00');
    });

    it('[NOT-177] 403 — rejects a VIEWER', async () => {
      const res = await request(app)
        .put(`/api/devices/${deviceId}/notification-policy`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ quietHoursStart: '22:00', quietHoursEnd: '07:00' });

      expect(res.status).toBe(403);
    });

    it('400 — rejects a start time without an end time', async () => {
      const res = await request(app)
        .put(`/api/devices/${deviceId}/notification-policy`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quietHoursStart: '22:00' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects a malformed time string', async () => {
      const res = await request(app)
        .put(`/api/devices/${deviceId}/notification-policy`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quietHoursStart: '25:00', quietHoursEnd: '07:00' });

      expect(res.status).toBe(400);
    });

    it('404 — device does not exist', async () => {
      const res = await request(app)
        .put(`/api/devices/${GHOST_ID}/notification-policy`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quietHoursStart: '22:00', quietHoursEnd: '07:00' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/devices/:id/notification-policy', () => {
    it('204 — resets the device back to always-notify defaults', async () => {
      await request(app)
        .put(`/api/devices/${deviceId}/notification-policy`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quietHoursStart: '22:00', quietHoursEnd: '07:00' });

      const res = await request(app)
        .delete(`/api/devices/${deviceId}/notification-policy`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);

      const after = await request(app)
        .get(`/api/devices/${deviceId}/notification-policy`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(after.body.quietHoursStart).toBeNull();
    });

    it('[NOT-177] 403 — rejects a VIEWER', async () => {
      const res = await request(app)
        .delete(`/api/devices/${deviceId}/notification-policy`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });

    it('400 — invalid device UUID', async () => {
      const res = await request(app)
        .delete(`/api/devices/${INVALID_ID}/notification-policy`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });
});

describe('Notification Policy Bulk Route — /api/notification-policies/bulk', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adminToken: string;
  let viewerToken: string;
  let deviceModelId: string;
  let deviceIdA: string;
  let deviceIdB: string;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    deviceIdA = await seedDevice(prisma, deviceModelId, {
      serialNumber: 'SN-BULK-A'
    });
    deviceIdB = await seedDevice(prisma, deviceModelId, {
      serialNumber: 'SN-BULK-B'
    });
  });

  it('200 — applies the same window to every listed device', async () => {
    const res = await request(app)
      .put('/api/notification-policies/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        deviceIds: [deviceIdA, deviceIdB],
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00'
      });

    expect(res.status).toBe(200);
    expect(res.body.updated).toHaveLength(2);
    expect(res.body.failed).toHaveLength(0);
  });

  it('200 — buckets a nonexistent device id under failed', async () => {
    const res = await request(app)
      .put('/api/notification-policies/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        deviceIds: [deviceIdA, GHOST_ID],
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00'
      });

    expect(res.status).toBe(200);
    expect(res.body.updated).toHaveLength(1);
    expect(res.body.failed).toHaveLength(1);
    expect(res.body.failed[0].id).toBe(GHOST_ID);
  });

  it('401 — rejects a request with no Authorization header', async () => {
    const res = await request(app)
      .put('/api/notification-policies/bulk')
      .send({ deviceIds: [deviceIdA] });

    expect(res.status).toBe(401);
  });

  it('[NOT-177] 403 — rejects a VIEWER', async () => {
    const res = await request(app)
      .put('/api/notification-policies/bulk')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ deviceIds: [deviceIdA] });

    expect(res.status).toBe(403);
  });

  it('400 — rejects an empty deviceIds array', async () => {
    const res = await request(app)
      .put('/api/notification-policies/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceIds: [] });

    expect(res.status).toBe(400);
  });
});
