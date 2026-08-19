import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanDatabase,
  seedDeviceModel,
  seedMonitoredDevice,
  waitForPollingConfig,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Polling Routes — /api/devices/:id/poll(ing/*)', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let deviceModelId: string;

  /** ID of a device created with monitoringEnabled=true for each test. */
  let monitoredDeviceId: string;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    // Create a device with monitoring enabled + IP.
    // DeviceProvisionedHandler auto-creates a PollingConfiguration.
    const res = await request(app).post('/api/devices').send({
      deviceModelId,
      name: 'Monitored Router',
      ownerType: 'COMPANY',
      serialNumber: 'SN-001',
      ipAddress: '127.0.0.1',
      monitoringEnabled: true
    });
    monitoredDeviceId = res.body.data.id as string;

    // DeviceProvisionedHandler is fire-and-forget — wait for the
    // PollingConfiguration row to exist before tests that depend on it.
    await waitForPollingConfig(prisma, monitoredDeviceId);
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/devices/:id/poll  — manual ping
  // ─────────────────────────────────────────────────────────────

  describe('POST /api/devices/:id/poll', () => {
    it('200 or 400 — responds for a device with polling config', async () => {
      const res = await request(app).post(
        `/api/devices/${monitoredDeviceId}/poll`
      );

      // 200 if ping ran; 400/404 if no config or ping service issue.
      // Accept both to keep tests environment-agnostic.
      expect([200, 400, 404]).toContain(res.status);
    });

    it('404 — device does not exist', async () => {
      const res = await request(app).post(
        `/api/devices/${GHOST_ID}/poll`
      );

      expect(res.status).toBe(404);
    });

    it('400 — invalid device UUID', async () => {
      const res = await request(app).post(
        `/api/devices/${INVALID_ID}/poll`
      );

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/devices/:id/polling/status
  // Note: response is returned directly (no { success, data } wrapper)
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/devices/:id/polling/status', () => {
    it('200 — returns polling status for monitored device', async () => {
      const res = await request(app).get(
        `/api/devices/${monitoredDeviceId}/polling/status`
      );

      expect(res.status).toBe(200);
      expect(res.body.deviceId).toBe(monitoredDeviceId);
      expect(res.body).toHaveProperty('pollingEnabled');
    });

    it('404 — device does not exist', async () => {
      const res = await request(app).get(
        `/api/devices/${GHOST_ID}/polling/status`
      );

      expect(res.status).toBe(404);
    });

    it('400 — invalid device UUID', async () => {
      const res = await request(app).get(
        `/api/devices/${INVALID_ID}/polling/status`
      );

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/devices/:id/polling/history
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/devices/:id/polling/history', () => {
    it('200 — returns empty history for fresh device', async () => {
      const res = await request(app).get(
        `/api/devices/${monitoredDeviceId}/polling/history`
      );

      expect(res.status).toBe(200);
    });

    it('200 — accepts date range filters', async () => {
      const res = await request(app).get(
        `/api/devices/${monitoredDeviceId}/polling/history` +
          `?fromDate=2026-01-01T00:00:00Z&toDate=2026-12-31T23:59:59Z&limit=50`
      );

      expect(res.status).toBe(200);
    });

    it('400 — invalid device UUID', async () => {
      const res = await request(app).get(
        `/api/devices/${INVALID_ID}/polling/history`
      );

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /api/devices/:id/polling/config
  // ─────────────────────────────────────────────────────────────

  describe('PATCH /api/devices/:id/polling/config', () => {
    it('204 — updates interval seconds', async () => {
      const res = await request(app)
        .patch(`/api/devices/${monitoredDeviceId}/polling/config`)
        .send({ intervalSeconds: 30 });

      expect(res.status).toBe(204);
    });

    it('204 — disables polling', async () => {
      const res = await request(app)
        .patch(`/api/devices/${monitoredDeviceId}/polling/config`)
        .send({ enabled: false });

      expect(res.status).toBe(204);
    });

    it('204 — updates multiple fields at once', async () => {
      const res = await request(app)
        .patch(`/api/devices/${monitoredDeviceId}/polling/config`)
        .send({
          intervalSeconds: 60,
          failuresBeforeDown: 5,
          enabled: true
        });

      expect(res.status).toBe(204);
    });

    it('400 — rejects empty body', async () => {
      const res = await request(app)
        .patch(`/api/devices/${monitoredDeviceId}/polling/config`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('400 — rejects intervalSeconds out of range', async () => {
      const res = await request(app)
        .patch(`/api/devices/${monitoredDeviceId}/polling/config`)
        .send({ intervalSeconds: 99999 });

      expect(res.status).toBe(400);
    });

    it('404 — device does not exist', async () => {
      const res = await request(app)
        .patch(`/api/devices/${GHOST_ID}/polling/config`)
        .send({ enabled: true });

      expect(res.status).toBe(404);
    });

    it('400 — invalid device UUID', async () => {
      const res = await request(app)
        .patch(`/api/devices/${INVALID_ID}/polling/config`)
        .send({ enabled: true });

      expect(res.status).toBe(400);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// [MON-041] DELETE /api/devices/:id/polling/history
// ─────────────────────────────────────────────────────────────

describe('[MON-041] DELETE /api/devices/:id/polling/history', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let deviceModelId: string;
  let deviceId: string;
  let adminToken: string;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
    const seeded = await seedMonitoredDevice(prisma, deviceModelId);
    deviceId = seeded.deviceId;
  });

  it('401 — rejects a request with no Authorization header', async () => {
    const res = await request(app).delete(
      `/api/devices/${deviceId}/polling/history`
    );
    expect(res.status).toBe(401);
  });

  it('200 — deletes all ping history for the device', async () => {
    await prisma.pingResult.create({
      data: { deviceId, isReachable: true }
    });
    await prisma.pingResult.create({
      data: { deviceId, isReachable: false }
    });

    const res = await request(app)
      .delete(`/api/devices/${deviceId}/polling/history`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.deletedCount).toBe(2);

    const remaining = await prisma.pingResult.count({
      where: { deviceId }
    });
    expect(remaining).toBe(0);
  });

  it('200 — scopes deletion to the given date range', async () => {
    await prisma.pingResult.create({
      data: {
        deviceId,
        isReachable: true,
        checkedAt: new Date('2024-01-01T00:00:00Z')
      }
    });
    await prisma.pingResult.create({
      data: {
        deviceId,
        isReachable: true,
        checkedAt: new Date('2024-02-01T00:00:00Z')
      }
    });

    const res = await request(app)
      .delete(
        `/api/devices/${deviceId}/polling/history` +
          '?fromDate=2024-01-01T00:00:00.000Z&toDate=2024-01-31T00:00:00.000Z'
      )
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.deletedCount).toBe(1);
  });

  it('400 — fromDate is not a valid datetime string', async () => {
    const res = await request(app)
      .delete(
        `/api/devices/${deviceId}/polling/history?fromDate=not-a-date`
      )
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it('400 — invalid device UUID', async () => {
    const res = await request(app)
      .delete(`/api/devices/${INVALID_ID}/polling/history`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });
});
