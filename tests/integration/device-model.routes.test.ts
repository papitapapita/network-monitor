// Source: src/presentation/http/routes/device-model.routes.ts
// Tests the full HTTP stack for device-model CRUD via supertest against a real Postgres DB.

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import {
  cleanCatalog,
  seedVendor,
  seedDevice,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Device Model Routes — /api/device-models', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adminToken: string;
  let viewerToken: string;
  let vendorId: string;
  let modelId: string;

  /** Creates a device model directly, bypassing the API under test. */
  async function seedModel(
    overrides: {
      vendorId?: string;
      model?: string;
      deviceType?: 'ANTENNA' | 'ROUTER' | 'ROUTERBOARD' | 'SWITCH';
      isWireless?: boolean;
    } = {}
  ): Promise<string> {
    const created = await prisma.deviceModel.create({
      data: {
        vendorId: overrides.vendorId ?? vendorId,
        model: overrides.model ?? 'RB4011iGS+',
        deviceType: overrides.deviceType ?? 'ROUTERBOARD',
        isWireless: overrides.isWireless ?? false
      }
    });
    return created.id;
  }

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
    await cleanCatalog(prisma);
    vendorId = await seedVendor(prisma, { name: 'MikroTik', slug: 'mikrotik' });
    modelId = await seedModel();
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/device-models
  // ─────────────────────────────────────────────────────────────

  describe('POST /api/device-models', () => {
    it('201 — creates a device model and returns full DTO shape', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId, model: 'UniFi AP AC Pro', deviceType: 'RADIO' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        id: expect.any(String),
        vendorId,
        model: 'UniFi AP AC Pro',
        deviceType: 'RADIO'
      });

      const row = await prisma.deviceModel.findUnique({
        where: { id: res.body.data.id }
      });
      expect(row!.model).toBe('UniFi AP AC Pro');
    });

    it('401 — rejects an unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .send({ vendorId, model: 'UniFi AP', deviceType: 'RADIO' });

      expect(res.status).toBe(401);
    });

    it('403 — rejects a VIEWER creating a device model', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ vendorId, model: 'UniFi AP', deviceType: 'RADIO' });

      expect(res.status).toBe(403);
    });

    it('[DEV-028] 201 — copies the vendor name and slug onto the model', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId, model: 'hAP ac3', deviceType: 'ROUTER' });

      expect(res.status).toBe(201);
      expect(res.body.data.vendorName).toBe('MikroTik');
      expect(res.body.data.vendorSlug).toBe('mikrotik');
    });

    it('[DEV-025] 201 — defaults isWireless to false when omitted', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId, model: 'CRS310', deviceType: 'SWITCH' });

      expect(res.status).toBe(201);
      expect(res.body.data.isWireless).toBe(false);
    });

    it('[DEV-025] 201 — honours an explicit isWireless true', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId, model: 'LHG 5', deviceType: 'ANTENNA', isWireless: true });

      expect(res.status).toBe(201);
      expect(res.body.data.isWireless).toBe(true);
    });

    it('[DEV-020] 400 — rejects missing vendorId', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ model: 'UniFi AP', deviceType: 'RADIO' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('[DEV-020] 400 — rejects missing model', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId, deviceType: 'RADIO' });

      expect(res.status).toBe(400);
    });

    it('[DEV-020] 400 — rejects missing deviceType', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId, model: 'UniFi AP' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects vendorId that is not a UUID v4', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId: INVALID_ID, model: 'UniFi AP', deviceType: 'RADIO' });

      expect(res.status).toBe(400);
    });

    it('[DEV-023] 201 — accepts a model name of exactly 150 characters', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId, model: 'A'.repeat(150), deviceType: 'SWITCH' });

      expect(res.status).toBe(201);
    });

    it('[DEV-023] 400 — rejects empty, whitespace-only and over-long model names', async () => {
      const bodies = ['', '   ', 'A'.repeat(151)];

      for (const model of bodies) {
        const res = await request(app)
          .post('/api/device-models')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ vendorId, model, deviceType: 'RADIO' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      }
    });

    it('[DEV-024] 400 — rejects a deviceType outside the seven allowed values', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId, model: 'UniFi AP', deviceType: 'INVALID_TYPE' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('[DEV-021] 404 — returns not found when vendorId is well-formed but absent', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId: GHOST_ID, model: 'UniFi AP', deviceType: 'RADIO' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('[DEV-022] 409 — rejects a duplicate model name for the same vendor', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId, model: 'RB4011iGS+', deviceType: 'ROUTERBOARD' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('[DEV-022] 201 — allows the same model name under a different vendor', async () => {
      const otherVendorId = await seedVendor(prisma, {
        name: 'Ubiquiti',
        slug: 'ubiquiti'
      });

      const res = await request(app)
        .post('/api/device-models')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId: otherVendorId, model: 'RB4011iGS+', deviceType: 'ROUTERBOARD' });

      expect(res.status).toBe(201);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/device-models
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/device-models', () => {
    it('200 — returns list including seeded models', async () => {
      const res = await request(app)
        .get('/api/device-models')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.deviceModels)).toBe(true);
    });

    it('200 — applies limit pagination', async () => {
      await seedModel({ model: 'hEX S' });

      const res = await request(app)
        .get('/api/device-models?limit=1&offset=0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.deviceModels).toHaveLength(1);
    });

    it('200 — applies offset pagination', async () => {
      const full = await request(app)
        .get('/api/device-models')
        .set('Authorization', `Bearer ${adminToken}`);
      const total = full.body.data.total as number;

      const res = await request(app)
        .get(`/api/device-models?limit=100&offset=${total}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.deviceModels).toHaveLength(0);
    });

    it('200 — a VIEWER may read the list', async () => {
      const res = await request(app)
        .get('/api/device-models')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
    });

    it('400 — rejects limit of 0', async () => {
      const res = await request(app)
        .get('/api/device-models?limit=0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('400 — rejects limit above 100', async () => {
      const res = await request(app)
        .get('/api/device-models?limit=101')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('401 — rejects an unauthenticated request', async () => {
      const res = await request(app).get('/api/device-models');

      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/device-models/:id
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/device-models/:id', () => {
    it('[DEV-028] 200 — returns the model with its vendor name and slug', async () => {
      const res = await request(app)
        .get(`/api/device-models/${modelId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(modelId);
      expect(res.body.data.vendorName).toBe('MikroTik');
      expect(res.body.data.vendorSlug).toBe('mikrotik');
      expect(res.body.data.model).toBe('RB4011iGS+');
    });

    it('404 — returns not found for unknown UUID', async () => {
      const res = await request(app)
        .get(`/api/device-models/${GHOST_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('400 — returns bad request for invalid UUID', async () => {
      const res = await request(app)
        .get(`/api/device-models/${INVALID_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('401 — rejects an unauthenticated request', async () => {
      const res = await request(app).get(`/api/device-models/${modelId}`);

      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PUT /api/device-models/:id
  // ─────────────────────────────────────────────────────────────

  describe('PUT /api/device-models/:id', () => {
    it('200 — updates the model name', async () => {
      const res = await request(app)
        .put(`/api/device-models/${modelId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ model: 'hAP ac3' });

      expect(res.status).toBe(200);
      expect(res.body.data.model).toBe('hAP ac3');
      expect(res.body.data.deviceType).toBe('ROUTERBOARD');

      const row = await prisma.deviceModel.findUnique({ where: { id: modelId } });
      expect(row!.model).toBe('hAP ac3');
    });

    it('[DEV-028] 200 — refreshes vendorName and vendorSlug when the vendor changes', async () => {
      const otherVendorId = await seedVendor(prisma, {
        name: 'Ubiquiti',
        slug: 'ubiquiti'
      });

      const res = await request(app)
        .put(`/api/device-models/${modelId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId: otherVendorId });

      expect(res.status).toBe(200);
      expect(res.body.data.vendorName).toBe('Ubiquiti');
      expect(res.body.data.vendorSlug).toBe('ubiquiti');
    });

    it('[DEV-027] 200 — turning off isWireless deletes the wireless config of its devices', async () => {
      const wirelessModelId = await seedModel({
        model: 'LHG 5',
        deviceType: 'ANTENNA',
        isWireless: true
      });
      const deviceId = await seedDevice(prisma, wirelessModelId, {
        name: 'CPE',
        serialNumber: 'SN-CASCADE'
      });
      await prisma.wirelessPollingConfiguration.create({
        data: { deviceId, deviceType: 'STATION' }
      });

      const res = await request(app)
        .put(`/api/device-models/${wirelessModelId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isWireless: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isWireless).toBe(false);
      await expect(
        prisma.wirelessPollingConfiguration.count()
      ).resolves.toBe(0);
    });

    it('[DEV-027] 200 — turning on isWireless leaves existing configs alone', async () => {
      const deviceId = await seedDevice(prisma, modelId, {
        name: 'CPE',
        serialNumber: 'SN-NO-CASCADE'
      });
      await prisma.wirelessPollingConfiguration.create({
        data: { deviceId, deviceType: 'STATION' }
      });

      const res = await request(app)
        .put(`/api/device-models/${modelId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isWireless: true });

      expect(res.status).toBe(200);
      await expect(
        prisma.wirelessPollingConfiguration.count()
      ).resolves.toBe(1);
    });

    it('[DEV-024] 400 — rejects a deviceType outside the seven allowed values', async () => {
      const res = await request(app)
        .put(`/api/device-models/${modelId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ deviceType: 'INVALID_TYPE' });

      expect(res.status).toBe(400);
    });

    it('400 — empty body returns 400', async () => {
      const res = await request(app)
        .put(`/api/device-models/${modelId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('404 — GHOST_ID not found', async () => {
      const res = await request(app)
        .put(`/api/device-models/${GHOST_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ model: 'Ghost Model' });

      expect(res.status).toBe(404);
    });

    it('400 — returns bad request for invalid UUID', async () => {
      const res = await request(app)
        .put(`/api/device-models/${INVALID_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ model: 'Whatever' });

      expect(res.status).toBe(400);
    });

    it('401 — rejects an unauthenticated request', async () => {
      const res = await request(app)
        .put(`/api/device-models/${modelId}`)
        .send({ model: 'Nope' });

      expect(res.status).toBe(401);
    });

    it('403 — rejects a VIEWER updating a device model', async () => {
      const res = await request(app)
        .put(`/api/device-models/${modelId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ model: 'Nope' });

      expect(res.status).toBe(403);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /api/device-models/:id
  // ─────────────────────────────────────────────────────────────

  describe('DELETE /api/device-models/:id', () => {
    it('204 — deletes successfully', async () => {
      const res = await request(app)
        .delete(`/api/device-models/${modelId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);

      const check = await request(app)
        .get(`/api/device-models/${modelId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(check.status).toBe(404);
    });

    it('404 — GHOST_ID not found', async () => {
      const res = await request(app)
        .delete(`/api/device-models/${GHOST_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('400 — returns bad request for invalid UUID', async () => {
      const res = await request(app)
        .delete(`/api/device-models/${INVALID_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('[DEV-026] 409 — returns 409 when the model has associated devices', async () => {
      await seedDevice(prisma, modelId, {
        name: 'Associated Device',
        serialNumber: 'SN-ASSOC'
      });

      const res = await request(app)
        .delete(`/api/device-models/${modelId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);

      const row = await prisma.deviceModel.findUnique({ where: { id: modelId } });
      expect(row).not.toBeNull();
    });

    it('401 — rejects an unauthenticated request', async () => {
      const res = await request(app).delete(`/api/device-models/${modelId}`);

      expect(res.status).toBe(401);
    });

    it('403 — rejects a VIEWER deleting a device model', async () => {
      const res = await request(app)
        .delete(`/api/device-models/${modelId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
