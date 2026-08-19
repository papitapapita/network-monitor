// Source: src/presentation/http/routes/admin.routes.ts
//         src/presentation/http/controllers/AdminController.ts
//         src/application/shared/use-cases/TriggerDataRetentionUseCase.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanDatabase,
  seedDeviceModel,
  seedMonitoredDevice
} from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import { seedAndGetToken } from './helpers/auth';

// Records seeded 100 days ago fall outside both the 30-day (ping/snapshot)
// and the 90-day (alerts/wireless-alert-records) retention windows.
const DAYS_100_AGO = new Date(Date.now() - 100 * 86_400_000);

describe('Admin Routes — POST /api/admin/data-retention/purge', () => {
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
  // Auth guard
  // ─────────────────────────────────────────────────────────────

  it('401 — rejects request with no token', async () => {
    const res = await request(app).post(
      '/api/admin/data-retention/purge'
    );

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────
  // Role guard
  // ─────────────────────────────────────────────────────────────

  it('403 — OPERATOR token is denied (no delete permission)', async () => {
    const token = await seedAndGetToken(app, prisma, 'OPERATOR');

    const res = await request(app)
      .post('/api/admin/data-retention/purge')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('403 — VIEWER token is denied (no delete permission)', async () => {
    const token = await seedAndGetToken(app, prisma, 'VIEWER');

    const res = await request(app)
      .post('/api/admin/data-retention/purge')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────
  // Happy path — no data
  // ─────────────────────────────────────────────────────────────

  it('200 — ADMIN token succeeds with all counts = 0 when no data exists', async () => {
    const token = await seedAndGetToken(app, prisma, 'ADMIN');

    const res = await request(app)
      .post('/api/admin/data-retention/purge')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      pingResultsDeleted: 0,
      alertsDeleted: 0,
      wirelessSnapshotsDeleted: 0,
      wirelessAlertRecordsDeleted: 0
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Happy path — old data is purged
  // ─────────────────────────────────────────────────────────────

  it('200 — deletes old ping results, resolved alerts, wireless snapshots, and cleared wireless alert records', async () => {
    const token = await seedAndGetToken(app, prisma, 'ADMIN');

    // Seed a ping result older than 30 days
    await prisma.pingResult.create({
      data: {
        deviceId,
        isReachable: false,
        checkedAt: DAYS_100_AGO
      }
    });

    // Seed a resolved alert older than 90 days
    await prisma.alertEvent.create({
      data: {
        deviceId,
        severity: 'CRITICAL',
        startedAt: DAYS_100_AGO,
        resolvedAt: DAYS_100_AGO
      }
    });

    // Seed a wireless snapshot older than 30 days (only required non-nullable fields)
    await prisma.wirelessSnapshot.create({
      data: {
        deviceId,
        deviceType: 'STATION',
        collectedAt: DAYS_100_AGO,
        collectionMethod: 'SNMP'
      }
    });

    // Seed a cleared wireless alert record older than 90 days
    await prisma.wirelessAlertRecord.create({
      data: {
        deviceId,
        metric: 'signal_rx_dbm',
        severity: 'WARNING',
        threshold: -75,
        triggeredAt: DAYS_100_AGO,
        clearedAt: DAYS_100_AGO,
        isActive: false,
        lastValue: -80,
        message: 'Signal below threshold'
      }
    });

    const res = await request(app)
      .post('/api/admin/data-retention/purge')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pingResultsDeleted).toBeGreaterThan(0);
    expect(res.body.data.alertsDeleted).toBeGreaterThan(0);
    expect(res.body.data.wirelessSnapshotsDeleted).toBeGreaterThan(0);
    expect(res.body.data.wirelessAlertRecordsDeleted).toBeGreaterThan(
      0
    );
  });

  // ─────────────────────────────────────────────────────────────
  // Active / open records are NOT deleted
  // ─────────────────────────────────────────────────────────────

  it('does not delete an open alert event (no resolvedAt) even when startedAt is old', async () => {
    const token = await seedAndGetToken(app, prisma, 'ADMIN');

    const openAlert = await prisma.alertEvent.create({
      data: {
        deviceId,
        severity: 'CRITICAL',
        startedAt: DAYS_100_AGO,
        resolvedAt: null
      }
    });

    await request(app)
      .post('/api/admin/data-retention/purge')
      .set('Authorization', `Bearer ${token}`);

    const surviving = await prisma.alertEvent.findUnique({
      where: { id: openAlert.id }
    });

    expect(surviving).not.toBeNull();
  });

  it('does not delete an active wireless alert record (isActive=true, no clearedAt) even when triggeredAt is old', async () => {
    const token = await seedAndGetToken(app, prisma, 'ADMIN');

    const activeRecord = await prisma.wirelessAlertRecord.create({
      data: {
        deviceId,
        metric: 'signal_rx_dbm',
        severity: 'CRITICAL',
        threshold: -75,
        triggeredAt: DAYS_100_AGO,
        clearedAt: null,
        isActive: true,
        lastValue: -82,
        message: 'Signal critically low'
      }
    });

    await request(app)
      .post('/api/admin/data-retention/purge')
      .set('Authorization', `Bearer ${token}`);

    const surviving = await prisma.wirelessAlertRecord.findUnique({
      where: { id: activeRecord.id }
    });

    expect(surviving).not.toBeNull();
  });
});
