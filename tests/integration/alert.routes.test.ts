import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanDatabase,
  seedDeviceModel,
  seedMonitoredDevice,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Alert Routes — GET /api/alerts', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let deviceModelId: string;
  let deviceId: string;

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
    const seeded = await seedMonitoredDevice(prisma, deviceModelId);
    deviceId = seeded.deviceId;
  });

  // ─────────────────────────────────────────────────────────────
  // 200 — success cases
  // ─────────────────────────────────────────────────────────────

  it('200 — returns empty list when no alerts exist', async () => {
    const res = await request(app).get('/api/alerts');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.alerts).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.hasMore).toBe(false);
  });

  it('200 — returns all alerts with correct shape', async () => {
    await prisma.alertEvent.create({
      data: { deviceId, severity: 'CRITICAL' }
    });

    const res = await request(app).get('/api/alerts');

    expect(res.status).toBe(200);
    expect(res.body.data.alerts).toHaveLength(1);
    const alert = res.body.data.alerts[0];
    expect(alert).toMatchObject({
      deviceId,
      severity: 'CRITICAL',
      status: 'OPEN'
    });
    expect(alert.id).toBeDefined();
    expect(alert.startedAt).toBeDefined();
    expect(alert.resolvedAt).toBeNull();
    expect(alert.notifiedAt).toBeNull();
    expect(alert.recoveryNotifiedAt).toBeNull();
    expect(alert.durationSecs).toBeNull();
  });

  it('200 — returns resolved alert with correct status', async () => {
    const startedAt = new Date('2025-06-01T10:00:00Z');
    const resolvedAt = new Date('2025-06-01T10:30:00Z');
    await prisma.alertEvent.create({
      data: {
        deviceId,
        severity: 'CRITICAL',
        startedAt,
        resolvedAt
      }
    });

    const res = await request(app).get('/api/alerts');

    expect(res.status).toBe(200);
    const alert = res.body.data.alerts[0];
    expect(alert.status).toBe('RESOLVED');
    expect(alert.resolvedAt).not.toBeNull();
    expect(alert.durationSecs).toBe(1800);
  });

  // ─────────────────────────────────────────────────────────────
  // Filtering by deviceId
  // ─────────────────────────────────────────────────────────────

  it('200 — filters alerts by deviceId query param', async () => {
    const other = await seedMonitoredDevice(prisma, deviceModelId, '10.0.0.2');

    await prisma.alertEvent.create({ data: { deviceId, severity: 'CRITICAL' } });
    await prisma.alertEvent.create({
      data: { deviceId: other.deviceId, severity: 'CRITICAL' }
    });

    const res = await request(app).get(`/api/alerts?deviceId=${deviceId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.alerts).toHaveLength(1);
    expect(res.body.data.alerts[0].deviceId).toBe(deviceId);
  });

  it('200 — returns empty list when filtering by a device with no alerts', async () => {
    const res = await request(app).get(`/api/alerts?deviceId=${GHOST_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.data.alerts).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────────────
  // Pagination
  // ─────────────────────────────────────────────────────────────

  it('200 — respects limit query param', async () => {
    await Promise.all(
      Array.from({ length: 5 }).map(() =>
        prisma.alertEvent.create({ data: { deviceId, severity: 'CRITICAL' } })
      )
    );

    const res = await request(app).get('/api/alerts?limit=2');

    expect(res.status).toBe(200);
    expect(res.body.data.alerts).toHaveLength(2);
    expect(res.body.data.limit).toBe(2);
  });

  it('200 — respects offset query param', async () => {
    for (let i = 0; i < 4; i++) {
      await prisma.alertEvent.create({
        data: {
          deviceId,
          severity: 'CRITICAL',
          startedAt: new Date(Date.now() + i * 1000)
        }
      });
    }

    const page1 = await request(app).get('/api/alerts?limit=2&offset=0');
    const page2 = await request(app).get('/api/alerts?limit=2&offset=2');

    expect(page1.status).toBe(200);
    expect(page2.status).toBe(200);
    expect(page1.body.data.alerts).toHaveLength(2);
    expect(page2.body.data.alerts).toHaveLength(2);

    const ids1 = page1.body.data.alerts.map((a: { id: string }) => a.id);
    const ids2 = page2.body.data.alerts.map((a: { id: string }) => a.id);
    expect(ids1.some((id: string) => ids2.includes(id))).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────
  // 400 — validation errors
  // ─────────────────────────────────────────────────────────────

  it('400 — rejects non-UUID deviceId query param', async () => {
    const res = await request(app).get(`/api/alerts?deviceId=${INVALID_ID}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('400 — rejects non-integer limit', async () => {
    const res = await request(app).get('/api/alerts?limit=abc');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('400 — rejects limit=0', async () => {
    const res = await request(app).get('/api/alerts?limit=0');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('400 — rejects limit exceeding 300', async () => {
    const res = await request(app).get('/api/alerts?limit=301');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('400 — rejects negative offset', async () => {
    const res = await request(app).get('/api/alerts?offset=-1');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
