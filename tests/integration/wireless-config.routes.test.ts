// Source: src/presentation/http/routes/wireless.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanDatabase,
  seedDeviceModel,
  seedWirelessDeviceModel,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';

// ─────────────────────────────────────────────────────────────
// Local seed helpers
// ─────────────────────────────────────────────────────────────

async function seedPlainDevice(
  prisma: PrismaClient,
  deviceModelId: string
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: 'Plain Test Device',
      owner: 'COMPANY',
      status: 'ACTIVE',
      monitoringEnabled: false,
      ipAddress: '10.0.0.1',
      category: 'WIRELESS_CPE',
      deviceModelId
    }
  });
  return device.id;
}

async function seedDeviceWithConfig(
  prisma: PrismaClient,
  deviceModelId: string
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: 'Configured Wireless Device',
      owner: 'COMPANY',
      status: 'ACTIVE',
      monitoringEnabled: true,
      ipAddress: '10.0.0.50',
      category: 'WIRELESS_CPE',
      deviceModelId
    }
  });

  await prisma.wirelessPollingConfiguration.create({
    data: {
      deviceId: device.id,
      deviceType: 'STATION',
      enabled: true,
      intervalSecs: 3600
    }
  });

  return device.id;
}

async function seedWiredDevice(
  prisma: PrismaClient,
  deviceModelId: string
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: 'Wired Router',
      owner: 'COMPANY',
      status: 'ACTIVE',
      monitoringEnabled: false,
      ipAddress: '10.0.0.2',
      category: 'CPE',
      deviceModelId
    }
  });
  return device.id;
}

// ─────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────

describe('Wireless Config Routes — /api/devices/:id/wireless/config', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  /** isWireless=true — used for wireless devices */
  let wirelessModelId: string;
  /** isWireless=false (ROUTERBOARD) — used for wired device */
  let wiredModelId: string;

  /** A wireless device (WIRELESS_CPE) with NO wireless config seeded. */
  let plainDeviceId: string;

  /** A wireless device that already has a wireless config seeded. */
  let configuredDeviceId: string;

  /** A wired device (CPE) — rejected because its model has isWireless=false. */
  let wiredDeviceId: string;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
    wirelessModelId = await seedWirelessDeviceModel(prisma);
    wiredModelId = await seedDeviceModel(prisma);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    plainDeviceId = await seedPlainDevice(prisma, wirelessModelId);
    configuredDeviceId = await seedDeviceWithConfig(prisma, wirelessModelId);
    wiredDeviceId = await seedWiredDevice(prisma, wiredModelId);
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/devices/:id/wireless/config
  // ─────────────────────────────────────────────────────────────

  describe('POST /api/devices/:id/wireless/config', () => {
    it('201 — creates config with required deviceType only and returns correct defaults', async () => {
      const res = await request(app)
        .post(`/api/devices/${plainDeviceId}/wireless/config`)
        .send({ deviceType: 'STATION' });

      expect(res.status).toBe(201);
      expect(res.body.deviceId).toBe(plainDeviceId);
      expect(res.body.deviceType).toBe('STATION');
      expect(res.body.enabled).toBe(true);
      expect(res.body.intervalSecs).toBe(3600);
    });

    it('201 — creates config with all optional fields and reflects them in the response', async () => {
      const res = await request(app)
        .post(`/api/devices/${plainDeviceId}/wireless/config`)
        .send({
          deviceType: 'ACCESS_POINT',
          ipAddress: '192.168.10.1',
          intervalSecs: 120,
          enabled: false,
          linkCapacityKbps: 100000000,
          clientsProvisionedLimit: 50
        });

      expect(res.status).toBe(201);
      expect(res.body.deviceId).toBe(plainDeviceId);
      expect(res.body.deviceType).toBe('ACCESS_POINT');
      expect(res.body.ipAddress).toBe('192.168.10.1');
      expect(res.body.intervalSecs).toBe(120);
      expect(res.body.enabled).toBe(false);
      expect(res.body.linkCapacityKbps).toBe(100000000);
      expect(res.body.clientsProvisionedLimit).toBe(50);
    });

    it('409 — returns 409 when a config already exists for the device', async () => {
      const res = await request(app)
        .post(`/api/devices/${configuredDeviceId}/wireless/config`)
        .send({ deviceType: 'STATION' });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
    });

    it('404 — returns 404 when the device does not exist', async () => {
      const res = await request(app)
        .post(`/api/devices/${GHOST_ID}/wireless/config`)
        .send({ deviceType: 'STATION' });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('400 — returns 400 when required deviceType field is missing', async () => {
      const res = await request(app)
        .post(`/api/devices/${plainDeviceId}/wireless/config`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('400 — returns 400 when intervalSecs is below the minimum of 30', async () => {
      const res = await request(app)
        .post(`/api/devices/${plainDeviceId}/wireless/config`)
        .send({ deviceType: 'STATION', intervalSecs: 10 });

      expect(res.status).toBe(400);
    });

    it('400 — returns 400 when the device is not wireless-capable (wired CPE)', async () => {
      const res = await request(app)
        .post(`/api/devices/${wiredDeviceId}/wireless/config`)
        .send({ deviceType: 'STATION' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('400 — returns 400 when device ID is not a valid UUID', async () => {
      const res = await request(app)
        .post(`/api/devices/${INVALID_ID}/wireless/config`)
        .send({ deviceType: 'STATION' });

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/devices/:id/wireless/config
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/devices/:id/wireless/config', () => {
    it('200 — returns the config with correct deviceId for a device that has one', async () => {
      const res = await request(app).get(
        `/api/devices/${configuredDeviceId}/wireless/config`
      );

      expect(res.status).toBe(200);
      expect(res.body.deviceId).toBe(configuredDeviceId);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('enabled');
      expect(res.body).toHaveProperty('intervalSecs');
      expect(res.body).toHaveProperty('deviceType');
    });

    it('404 — returns 404 when device exists but has no config', async () => {
      const res = await request(app).get(
        `/api/devices/${plainDeviceId}/wireless/config`
      );

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('404 — returns 404 when device does not exist', async () => {
      const res = await request(app).get(
        `/api/devices/${GHOST_ID}/wireless/config`
      );

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('400 — returns 400 when device ID is not a valid UUID', async () => {
      const res = await request(app).get(
        `/api/devices/${INVALID_ID}/wireless/config`
      );

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /api/devices/:id/wireless/config
  // ─────────────────────────────────────────────────────────────

  describe('PATCH /api/devices/:id/wireless/config', () => {
    it('200 — updates enabled to false and reflects it in the response', async () => {
      const res = await request(app)
        .patch(`/api/devices/${configuredDeviceId}/wireless/config`)
        .send({ enabled: false });

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
      expect(res.body.deviceId).toBe(configuredDeviceId);
    });

    it('200 — updates intervalSecs to a new valid value and reflects it in the response', async () => {
      const res = await request(app)
        .patch(`/api/devices/${configuredDeviceId}/wireless/config`)
        .send({ intervalSecs: 300 });

      expect(res.status).toBe(200);
      expect(res.body.intervalSecs).toBe(300);
    });

    it('200 — updates ipAddress to a valid IPv4 and reflects it in the response', async () => {
      const res = await request(app)
        .patch(`/api/devices/${configuredDeviceId}/wireless/config`)
        .send({ ipAddress: '172.16.0.1' });

      expect(res.status).toBe(200);
      expect(res.body.ipAddress).toBe('172.16.0.1');
    });

    it('400 — returns 400 when body is empty (at least one field required)', async () => {
      const res = await request(app)
        .patch(`/api/devices/${configuredDeviceId}/wireless/config`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('400 — returns 400 when intervalSecs is below the minimum of 30', async () => {
      const res = await request(app)
        .patch(`/api/devices/${configuredDeviceId}/wireless/config`)
        .send({ intervalSecs: 10 });

      expect(res.status).toBe(400);
    });

    it('404 — returns 404 when device exists but has no config', async () => {
      const res = await request(app)
        .patch(`/api/devices/${plainDeviceId}/wireless/config`)
        .send({ enabled: false });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('404 — returns 404 when device does not exist', async () => {
      const res = await request(app)
        .patch(`/api/devices/${GHOST_ID}/wireless/config`)
        .send({ enabled: false });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('400 — returns 400 when device ID is not a valid UUID', async () => {
      const res = await request(app)
        .patch(`/api/devices/${INVALID_ID}/wireless/config`)
        .send({ enabled: false });

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /api/devices/:id/wireless/config
  // ─────────────────────────────────────────────────────────────

  describe('DELETE /api/devices/:id/wireless/config', () => {
    it('204 — deletes the config and a subsequent GET returns 404', async () => {
      const deleteRes = await request(app).delete(
        `/api/devices/${configuredDeviceId}/wireless/config`
      );

      expect(deleteRes.status).toBe(204);
      expect(deleteRes.body).toEqual({});

      const getRes = await request(app).get(
        `/api/devices/${configuredDeviceId}/wireless/config`
      );

      expect(getRes.status).toBe(404);
    });

    it('404 — returns 404 when device exists but has no config', async () => {
      const res = await request(app).delete(
        `/api/devices/${plainDeviceId}/wireless/config`
      );

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('404 — returns 404 when device does not exist', async () => {
      const res = await request(app).delete(
        `/api/devices/${GHOST_ID}/wireless/config`
      );

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('400 — returns 400 when device ID is not a valid UUID', async () => {
      const res = await request(app).delete(
        `/api/devices/${INVALID_ID}/wireless/config`
      );

      expect(res.status).toBe(400);
    });
  });
});
