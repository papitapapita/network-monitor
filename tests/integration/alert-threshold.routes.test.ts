// Source: src/presentation/http/routes/alert-threshold.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import {
  cleanDatabase,
  seedDevice,
  seedWirelessDeviceModel,
  seedWirelessConfig,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';

const DEFAULTS = {
  signalDbm: { warning: -70, critical: -80 },
  snrDb: { warning: 15, critical: 10 },
  ccqPercent: { warning: 75, critical: 50 },
  latencyMs: { warning: 50, critical: 150 },
  cpuPercent: 80,
  memoryPercent: 85,
  clockDriftSeconds: 300,
  saturationPercent: 80,
  clientDropPercent: 50,
  minCapacityMbps: { '20': 50, '40': 100, '80': 200 },
  maxDistanceKm: { '20': 15, '40': 10, '80': 5 }
};

const SAVED = {
  ...DEFAULTS,
  minCapacityMbps: { '20': 50, '40': 150, '80': 200 },
  maxDistanceKm: { '20': 15, '40': 12.5, '80': 5 }
};

describe('Alert Threshold Routes', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adminToken: string;
  let operatorToken: string;
  let viewerToken: string;
  let deviceId: string;

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
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
    operatorToken = await seedAndGetToken(app, prisma, 'OPERATOR');
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
    const modelId = await seedWirelessDeviceModel(prisma);
    deviceId = await seedWirelessConfig(
      prisma,
      await seedDevice(prisma, modelId)
    );
  });

  describe('GET /api/wireless/alert-thresholds', () => {
    it('[WLS-200] 200 — answers the defaults before anything is saved', async () => {
      const res = await request(app)
        .get('/api/wireless/alert-thresholds')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { thresholds: DEFAULTS, defaults: DEFAULTS }
      });
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app).get(
        '/api/wireless/alert-thresholds'
      );
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/wireless/alert-thresholds', () => {
    it('[WLS-200] 200 — saves the set, and a GET reads it back', async () => {
      const put = await request(app)
        .put('/api/wireless/alert-thresholds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(SAVED);
      const get = await request(app)
        .get('/api/wireless/alert-thresholds')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(put.status).toBe(200);
      expect(put.body.data.thresholds).toEqual(SAVED);
      expect(get.body.data).toEqual({
        thresholds: SAVED,
        defaults: DEFAULTS
      });
    });

    it('[WLS-200] 400 — rejects a warning that is not above its critical', async () => {
      const res = await request(app)
        .put('/api/wireless/alert-thresholds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...DEFAULTS,
          signalDbm: { warning: -85, critical: -80 }
        });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error:
          'signalDbm.warning must be higher than signalDbm.critical'
      });
    });

    it('400 — rejects a missing group', async () => {
      const { cpuPercent: _omitted, ...partial } = DEFAULTS;
      const res = await request(app)
        .put('/api/wireless/alert-thresholds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(partial);

      expect(res.status).toBe(400);
    });

    it('400 — rejects an unknown field', async () => {
      const res = await request(app)
        .put('/api/wireless/alert-thresholds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...DEFAULTS, rssiDbm: -60 });

      expect(res.status).toBe(400);
    });

    it('[WLS-202] 403 — an OPERATOR cannot change them', async () => {
      const res = await request(app)
        .put('/api/wireless/alert-thresholds')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(SAVED);

      expect(res.status).toBe(403);
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app)
        .put('/api/wireless/alert-thresholds')
        .send(SAVED);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/devices/:id/wireless/alert-thresholds', () => {
    it('[WLS-201] 200 — a device with no overrides follows the install', async () => {
      const res = await request(app)
        .get(`/api/devices/${deviceId}/wireless/alert-thresholds`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          deviceId,
          overrides: {},
          install: DEFAULTS,
          effective: DEFAULTS
        }
      });
    });

    it('404 — a device with no wireless config', async () => {
      const res = await request(app)
        .get(`/api/devices/${GHOST_ID}/wireless/alert-thresholds`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('400 — a malformed device id', async () => {
      const res = await request(app)
        .get(`/api/devices/${INVALID_ID}/wireless/alert-thresholds`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(400);
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app).get(
        `/api/devices/${deviceId}/wireless/alert-thresholds`
      );
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/devices/:id/wireless/alert-thresholds', () => {
    const OVERRIDES = { maxDistanceKm: { '40': 30 } };

    it('[WLS-201] 200 — an OPERATOR overrides one group; the rest follows the install', async () => {
      const put = await request(app)
        .put(`/api/devices/${deviceId}/wireless/alert-thresholds`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ overrides: OVERRIDES });
      const get = await request(app)
        .get(`/api/devices/${deviceId}/wireless/alert-thresholds`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(put.status).toBe(200);
      expect(get.body.data.overrides).toEqual(OVERRIDES);
      expect(get.body.data.effective).toEqual({
        ...DEFAULTS,
        maxDistanceKm: { '20': 15, '40': 30, '80': 5 }
      });
    });

    it('[WLS-201] 200 — empty overrides return the device to the install', async () => {
      await request(app)
        .put(`/api/devices/${deviceId}/wireless/alert-thresholds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ overrides: OVERRIDES });
      const res = await request(app)
        .put(`/api/devices/${deviceId}/wireless/alert-thresholds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ overrides: {} });

      expect(res.status).toBe(200);
      expect(res.body.data.effective).toEqual(DEFAULTS);
      expect(
        await prisma.wirelessAlertThresholdOverride.count()
      ).toBe(0);
    });

    it('400 — rejects an out-of-range override', async () => {
      const res = await request(app)
        .put(`/api/devices/${deviceId}/wireless/alert-thresholds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ overrides: { maxDistanceKm: { '40': 500 } } });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        'maxDistanceKm.40 must be from 0.1 to 200'
      );
    });

    it('400 — rejects a body without overrides', async () => {
      const res = await request(app)
        .put(`/api/devices/${deviceId}/wireless/alert-thresholds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(OVERRIDES);

      expect(res.status).toBe(400);
    });

    it('404 — a device with no wireless config', async () => {
      const res = await request(app)
        .put(`/api/devices/${GHOST_ID}/wireless/alert-thresholds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ overrides: OVERRIDES });

      expect(res.status).toBe(404);
    });

    it('403 — a VIEWER cannot override', async () => {
      const res = await request(app)
        .put(`/api/devices/${deviceId}/wireless/alert-thresholds`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ overrides: OVERRIDES });

      expect(res.status).toBe(403);
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app)
        .put(`/api/devices/${deviceId}/wireless/alert-thresholds`)
        .send({ overrides: OVERRIDES });
      expect(res.status).toBe(401);
    });
  });
});
