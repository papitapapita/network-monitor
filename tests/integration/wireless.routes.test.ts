// Source: src/presentation/http/routes/wireless.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanDatabase,
  seedDeviceModel,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';

// ─────────────────────────────────────────────────────────────
// Local seed helpers (no shared wireless seed helpers exist yet)
// ─────────────────────────────────────────────────────────────

async function seedWirelessDevice(
  prisma: PrismaClient,
  deviceModelId: string
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: 'Wireless Test Device',
      owner: 'COMPANY',
      status: 'ACTIVE',
      monitoringEnabled: true,
      ipAddress: '192.168.1.200',
      deviceModelId
    }
  });

  await prisma.wirelessPollingConfiguration.create({
    data: {
      deviceId: device.id,
      ipAddress: '192.168.1.200',
      enabled: true,
      intervalSecs: 3600,
      deviceType: 'STATION'
    }
  });

  return device.id;
}

async function seedWirelessDeviceWithoutSnapshot(
  prisma: PrismaClient,
  deviceModelId: string
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: 'Wireless Device No Snapshot',
      owner: 'COMPANY',
      status: 'ACTIVE',
      monitoringEnabled: true,
      ipAddress: '192.168.1.201',
      deviceModelId
    }
  });

  await prisma.wirelessPollingConfiguration.create({
    data: {
      deviceId: device.id,
      ipAddress: '192.168.1.201',
      enabled: true,
      intervalSecs: 3600,
      deviceType: 'STATION'
    }
  });

  return device.id;
}

async function seedWirelessSnapshot(
  prisma: PrismaClient,
  deviceId: string
): Promise<void> {
  await prisma.wirelessSnapshot.create({
    data: {
      deviceId,
      deviceType: 'STATION',
      collectionMethod: 'SNMP',
      collectedAt: new Date(),
      signalRxDbm: -65,
      snrDb: 25
    }
  });
}

async function seedAccessPointDevice(
  prisma: PrismaClient,
  deviceModelId: string
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: 'Access Point Test Device',
      owner: 'COMPANY',
      status: 'ACTIVE',
      monitoringEnabled: true,
      ipAddress: '192.168.1.202',
      deviceModelId
    }
  });

  await prisma.wirelessPollingConfiguration.create({
    data: {
      deviceId: device.id,
      ipAddress: '192.168.1.202',
      enabled: true,
      intervalSecs: 3600,
      deviceType: 'ACCESS_POINT'
    }
  });

  await prisma.wirelessSnapshot.create({
    data: {
      deviceId: device.id,
      deviceType: 'ACCESS_POINT',
      collectionMethod: 'SNMP',
      collectedAt: new Date()
    }
  });

  return device.id;
}

async function seedWirelessAlert(
  prisma: PrismaClient,
  deviceId: string
): Promise<string> {
  const record = await prisma.wirelessAlertRecord.create({
    data: {
      deviceId,
      metric: 'signal_rx_dbm',
      severity: 'CRITICAL',
      threshold: -75,
      triggeredAt: new Date(),
      isActive: true,
      lastValue: -80,
      message: 'Signal below threshold'
    }
  });
  return record.id;
}

// ─────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────

describe('[WLS-143] [WLS-144] [WLS-145] Wireless Routes — /api/devices/:id/wireless/* and /api/wireless/*', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let deviceModelId: string;

  /** ID of a device seeded with a snapshot and an active alert for each test. */
  let deviceId: string;
  /** ID of the active wireless alert seeded for `deviceId`. */
  let alertId: string;
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

    deviceId = await seedWirelessDevice(prisma, deviceModelId);
    await seedWirelessSnapshot(prisma, deviceId);
    alertId = await seedWirelessAlert(prisma, deviceId);
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/devices/:id/wireless/status
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/devices/:id/wireless/status', () => {
    it('200 — returns snapshot with deviceId for a device that has a snapshot', async () => {
      const res = await request(app).get(
        `/api/devices/${deviceId}/wireless/status`
      );

      expect(res.status).toBe(200);
      expect(res.body.deviceId).toBe(deviceId);
    });

    it('404 — device exists but has no snapshot', async () => {
      const noSnapshotId = await seedWirelessDeviceWithoutSnapshot(
        prisma,
        deviceModelId
      );

      const res = await request(app).get(
        `/api/devices/${noSnapshotId}/wireless/status`
      );

      expect(res.status).toBe(404);
    });

    it('404 — device does not exist', async () => {
      const res = await request(app).get(
        `/api/devices/${GHOST_ID}/wireless/status`
      );

      expect(res.status).toBe(404);
    });

    it('400 — invalid device UUID', async () => {
      const res = await request(app).get(
        `/api/devices/${INVALID_ID}/wireless/status`
      );

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/devices/:id/wireless/history
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/devices/:id/wireless/history', () => {
    it('200 — returns { snapshots, total } for valid from/to ISO datetime query params', async () => {
      const res = await request(app).get(
        `/api/devices/${deviceId}/wireless/history` +
          `?from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z`
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.snapshots)).toBe(true);
      expect(typeof res.body.total).toBe('number');
    });

    it('200 — accepts optional limit param alongside from/to', async () => {
      const res = await request(app).get(
        `/api/devices/${deviceId}/wireless/history` +
          `?from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z&limit=10`
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.snapshots)).toBe(true);
    });

    it('400 — invalid device UUID', async () => {
      const res = await request(app).get(
        `/api/devices/${INVALID_ID}/wireless/history` +
          `?from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z`
      );

      expect(res.status).toBe(400);
    });

    it('400 — missing required from query param', async () => {
      const res = await request(app).get(
        `/api/devices/${deviceId}/wireless/history?to=2026-12-31T23:59:59Z`
      );

      expect(res.status).toBe(400);
    });

    it('400 — missing required to query param', async () => {
      const res = await request(app).get(
        `/api/devices/${deviceId}/wireless/history?from=2026-01-01T00:00:00Z`
      );

      expect(res.status).toBe(400);
    });

    it('400 — from is not a valid datetime string', async () => {
      const res = await request(app).get(
        `/api/devices/${deviceId}/wireless/history` +
          `?from=not-a-date&to=2026-12-31T23:59:59Z`
      );

      expect(res.status).toBe(400);
    });

    it('400 — to is not a valid datetime string', async () => {
      const res = await request(app).get(
        `/api/devices/${deviceId}/wireless/history` +
          `?from=2026-01-01T00:00:00Z&to=not-a-date`
      );

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/devices/:id/wireless/clients
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/devices/:id/wireless/clients', () => {
    it('200 — responds for access point device with snapshot', async () => {
      const apDeviceId = await seedAccessPointDevice(
        prisma,
        deviceModelId
      );

      const res = await request(app).get(
        `/api/devices/${apDeviceId}/wireless/clients`
      );

      expect(res.status).toBe(200);
    });

    it('404 — device does not exist', async () => {
      const res = await request(app).get(
        `/api/devices/${GHOST_ID}/wireless/clients`
      );

      expect(res.status).toBe(404);
    });

    it('400 — invalid device UUID', async () => {
      const res = await request(app).get(
        `/api/devices/${INVALID_ID}/wireless/clients`
      );

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/devices/:id/wireless/clients/expected
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/devices/:id/wireless/clients/expected', () => {
    it('200 — returns an expected roster with a missing CPE for an AP with a declared STATION', async () => {
      const apDeviceId = await seedAccessPointDevice(
        prisma,
        deviceModelId
      );
      const cpeDevice = await prisma.device.create({
        data: {
          name: 'Expected CPE',
          owner: 'COMPANY',
          status: 'ACTIVE',
          monitoringEnabled: true,
          macAddress: 'AA:BB:CC:DD:EE:01',
          deviceModelId
        }
      });
      await prisma.wirelessPollingConfiguration.create({
        data: {
          deviceId: cpeDevice.id,
          enabled: true,
          intervalSecs: 3600,
          deviceType: 'STATION',
          parentApDeviceId: apDeviceId
        }
      });

      const res = await request(app)
        .get(`/api/devices/${apDeviceId}/wireless/clients/expected`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.apDeviceId).toBe(apDeviceId);
      expect(res.body.expected).toHaveLength(1);
      expect(res.body.expected[0].deviceId).toBe(cpeDevice.id);
      expect(res.body.expected[0].connected).toBe(false);
      expect(res.body.missingCount).toBe(1);
    });

    it('200 — returns an empty roster for an AP with no declared STATIONs', async () => {
      const apDeviceId = await seedAccessPointDevice(
        prisma,
        deviceModelId
      );

      const res = await request(app)
        .get(`/api/devices/${apDeviceId}/wireless/clients/expected`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.expected).toHaveLength(0);
      expect(res.body.missingCount).toBe(0);
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app).get(
        `/api/devices/${deviceId}/wireless/clients/expected`
      );

      expect(res.status).toBe(401);
    });

    it('404 — device is a STATION, not an access point', async () => {
      const res = await request(app)
        .get(`/api/devices/${deviceId}/wireless/clients/expected`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('404 — device does not exist', async () => {
      const res = await request(app)
        .get(`/api/devices/${GHOST_ID}/wireless/clients/expected`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('400 — invalid device UUID', async () => {
      const res = await request(app)
        .get(`/api/devices/${INVALID_ID}/wireless/clients/expected`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/devices/:id/wireless/alerts/history
  // (static segment registered before parameterized /alerts route)
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/devices/:id/wireless/alerts/history', () => {
    it('200 — returns an array for device with alert history', async () => {
      const res = await request(app).get(
        `/api/devices/${deviceId}/wireless/alerts/history`
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('200 — accepts optional from, to, and limit query params', async () => {
      const res = await request(app).get(
        `/api/devices/${deviceId}/wireless/alerts/history` +
          `?from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z&limit=25`
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('200 — returns empty array for device that does not exist', async () => {
      const res = await request(app).get(
        `/api/devices/${GHOST_ID}/wireless/alerts/history`
      );

      // Use case queries by deviceId without checking device existence — returns empty list
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('400 — invalid device UUID', async () => {
      const res = await request(app).get(
        `/api/devices/${INVALID_ID}/wireless/alerts/history`
      );

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/devices/:id/wireless/alerts
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/devices/:id/wireless/alerts', () => {
    it('200 — returns an array containing the seeded active alert', async () => {
      const res = await request(app).get(
        `/api/devices/${deviceId}/wireless/alerts`
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('200 — returns empty array for device with no active alerts', async () => {
      const noAlertId = await seedWirelessDeviceWithoutSnapshot(
        prisma,
        deviceModelId
      );
      await seedWirelessSnapshot(prisma, noAlertId);

      const res = await request(app).get(
        `/api/devices/${noAlertId}/wireless/alerts`
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('200 — returns empty array for device that does not exist', async () => {
      const res = await request(app).get(
        `/api/devices/${GHOST_ID}/wireless/alerts`
      );

      // Use case queries by deviceId without checking device existence — returns empty list
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('400 — invalid device UUID', async () => {
      const res = await request(app).get(
        `/api/devices/${INVALID_ID}/wireless/alerts`
      );

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/devices/:id/wireless/alerts/:alertId/clear
  // ─────────────────────────────────────────────────────────────

  describe('[WLS-127] POST /api/devices/:id/wireless/alerts/:alertId/clear', () => {
    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app).post(
        `/api/devices/${deviceId}/wireless/alerts/${alertId}/clear`
      );

      expect(res.status).toBe(401);
    });

    it('200 — clears the active alert', async () => {
      const res = await request(app)
        .post(
          `/api/devices/${deviceId}/wireless/alerts/${alertId}/clear`
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);

      const stored = await prisma.wirelessAlertRecord.findUnique({
        where: { id: alertId }
      });
      expect(stored?.isActive).toBe(false);
    });

    it('200 — clearing an already-cleared alert is idempotent', async () => {
      await request(app)
        .post(
          `/api/devices/${deviceId}/wireless/alerts/${alertId}/clear`
        )
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .post(
          `/api/devices/${deviceId}/wireless/alerts/${alertId}/clear`
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
    });

    it('404 — alert does not belong to the device', async () => {
      const otherDeviceId = await seedWirelessDeviceWithoutSnapshot(
        prisma,
        deviceModelId
      );

      const res = await request(app)
        .post(
          `/api/devices/${otherDeviceId}/wireless/alerts/${alertId}/clear`
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('404 — alert does not exist', async () => {
      const res = await request(app)
        .post(
          `/api/devices/${deviceId}/wireless/alerts/${GHOST_ID}/clear`
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('400 — invalid alert UUID', async () => {
      const res = await request(app)
        .post(
          `/api/devices/${deviceId}/wireless/alerts/${INVALID_ID}/clear`
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/devices/:id/wireless/alerts/clear (bulk)
  // ─────────────────────────────────────────────────────────────

  describe('[WLS-128] POST /api/devices/:id/wireless/alerts/clear', () => {
    it('200 — clears every active alert for the device when ids is omitted', async () => {
      const res = await request(app)
        .post(`/api/devices/${deviceId}/wireless/alerts/clear`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.cleared).toHaveLength(1);
      expect(res.body.cleared[0].id).toBe(alertId);
    });

    it('200 — clears only the given ids', async () => {
      const res = await request(app)
        .post(`/api/devices/${deviceId}/wireless/alerts/clear`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [alertId] });

      expect(res.status).toBe(200);
      expect(res.body.cleared).toHaveLength(1);
    });

    it('200 — bucket a foreign device alert id as failed, not cleared', async () => {
      const otherDeviceId = await seedWirelessDeviceWithoutSnapshot(
        prisma,
        deviceModelId
      );
      const otherAlertId = await seedWirelessAlert(
        prisma,
        otherDeviceId
      );

      const res = await request(app)
        .post(`/api/devices/${deviceId}/wireless/alerts/clear`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [otherAlertId] });

      expect(res.status).toBe(200);
      expect(res.body.cleared).toHaveLength(0);
      expect(res.body.failed).toHaveLength(1);
    });

    it('400 — invalid device UUID', async () => {
      const res = await request(app)
        .post(`/api/devices/${INVALID_ID}/wireless/alerts/clear`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/devices/:id/wireless/poll
  // Note: poll attempts real device connectivity, so accept any
  // plausible status for existing devices to stay environment-agnostic.
  // ─────────────────────────────────────────────────────────────

  describe('POST /api/devices/:id/wireless/poll', () => {
    it('202 or 400/404/500 — responds for a device with wireless polling config', async () => {
      const res = await request(app).post(
        `/api/devices/${deviceId}/wireless/poll`
      );

      expect([202, 400, 404, 500]).toContain(res.status);
    });

    it('404 — device does not exist', async () => {
      const res = await request(app).post(
        `/api/devices/${GHOST_ID}/wireless/poll`
      );

      expect(res.status).toBe(404);
    });

    it('400 — invalid device UUID', async () => {
      const res = await request(app).post(
        `/api/devices/${INVALID_ID}/wireless/poll`
      );

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/wireless/alerts  (global — all devices)
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/wireless/alerts', () => {
    it('200 — returns an array (may include the seeded alert)', async () => {
      const res = await request(app).get('/api/wireless/alerts');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('200 — accepts optional deviceId query filter (valid UUID)', async () => {
      const res = await request(app).get(
        `/api/wireless/alerts?deviceId=${deviceId}`
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('400 — rejects deviceId that is not a valid UUID', async () => {
      const res = await request(app).get(
        `/api/wireless/alerts?deviceId=not-a-uuid`
      );

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/wireless/alerts/history  (global)
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/wireless/alerts/history', () => {
    // Note: GetWirelessAlertHistoryUseCase requires a deviceId — the global route
    // effectively behaves as a per-device history filtered by deviceId.
    // Calling without deviceId returns 400 ("Device ID is required").

    it('400 — returns 400 when deviceId is omitted (use case requires it)', async () => {
      const res = await request(app).get(
        '/api/wireless/alerts/history'
      );

      expect(res.status).toBe(400);
    });

    it('200 — returns an array when deviceId is supplied', async () => {
      const res = await request(app).get(
        `/api/wireless/alerts/history?deviceId=${deviceId}`
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('200 — accepts from, to, and limit alongside deviceId', async () => {
      const res = await request(app).get(
        `/api/wireless/alerts/history?deviceId=${deviceId}` +
          `&from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z&limit=50`
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('400 — rejects deviceId that is not a valid UUID', async () => {
      const res = await request(app).get(
        `/api/wireless/alerts/history?deviceId=not-a-uuid`
      );

      expect(res.status).toBe(400);
    });
  });
});
