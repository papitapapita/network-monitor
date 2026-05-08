import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  seedDeviceModel,
  cleanCatalog,
  seedVendor,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Device Model Routes — /api/device-models', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let seededModelId: string;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
    seededModelId = await seedDeviceModel(prisma);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/device-models
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/device-models', () => {
    it('200 — returns list including seeded models', async () => {
      const res = await request(app).get('/api/device-models');

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.deviceModels)).toBe(true);
    });

    it('200 — applies limit pagination', async () => {
      const res = await request(app).get('/api/device-models?limit=1&offset=0');

      expect(res.status).toBe(200);
      expect(res.body.data.deviceModels).toHaveLength(1);
    });

    it('200 — applies offset pagination', async () => {
      const full = await request(app).get('/api/device-models');
      const total = full.body.data.total as number;

      const res = await request(app).get(
        `/api/device-models?limit=100&offset=${total}`
      );

      expect(res.status).toBe(200);
      expect(res.body.data.deviceModels).toHaveLength(0);
    });

    it('400 — rejects limit of 0', async () => {
      const res = await request(app).get('/api/device-models?limit=0');

      expect(res.status).toBe(400);
    });

    it('400 — rejects limit above 100', async () => {
      const res = await request(app).get('/api/device-models?limit=101');

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/device-models/:id
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/device-models/:id', () => {
    it('200 — returns the seeded device model', async () => {
      const res = await request(app).get(
        `/api/device-models/${seededModelId}`
      );

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(seededModelId);
      expect(res.body.data.vendorName).toBe('MikroTik');
      expect(res.body.data.model).toBe('RB4011iGS+');
    });

    it('404 — returns not found for unknown UUID', async () => {
      const res = await request(app).get(
        `/api/device-models/${GHOST_ID}`
      );

      expect(res.status).toBe(404);
    });

    it('400 — returns bad request for invalid UUID', async () => {
      const res = await request(app).get(
        `/api/device-models/${INVALID_ID}`
      );

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/device-models
  // ─────────────────────────────────────────────────────────────

  describe('POST /api/device-models', () => {
    let postVendorId: string;

    beforeEach(async () => {
      await cleanCatalog(prisma);
      postVendorId = await seedVendor(prisma, {
        name: 'Ubiquiti',
        slug: 'ubiquiti-post'
      });
    });

    it('201 — creates a device model and returns full DTO shape', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .send({ vendorId: postVendorId, model: 'UniFi AP AC Pro', deviceType: 'RADIO' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        id: expect.any(String),
        vendorId: postVendorId,
        vendorName: 'Ubiquiti',
        model: 'UniFi AP AC Pro',
        deviceType: 'RADIO'
      });
    });

    it('201 — accepts model name at exactly 150 characters', async () => {
      const model = 'A'.repeat(150);
      const res = await request(app)
        .post('/api/device-models')
        .send({ vendorId: postVendorId, model, deviceType: 'SWITCH' });

      expect(res.status).toBe(201);
    });

    it('400 — rejects missing vendorId', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .send({ model: 'UniFi AP', deviceType: 'RADIO' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('400 — rejects missing model', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .send({ vendorId: postVendorId, deviceType: 'RADIO' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('400 — rejects missing deviceType', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .send({ vendorId: postVendorId, model: 'UniFi AP' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('400 — rejects vendorId that is not a UUID v4', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .send({ vendorId: 'not-a-uuid', model: 'UniFi AP', deviceType: 'RADIO' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('400 — rejects empty model name', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .send({ vendorId: postVendorId, model: '', deviceType: 'RADIO' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('400 — rejects whitespace-only model name', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .send({ vendorId: postVendorId, model: '   ', deviceType: 'RADIO' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('400 — rejects model name exceeding 150 characters', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .send({ vendorId: postVendorId, model: 'A'.repeat(151), deviceType: 'RADIO' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('400 — rejects invalid deviceType', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .send({ vendorId: postVendorId, model: 'UniFi AP', deviceType: 'INVALID_TYPE' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('404 — returns not found when vendorId is a valid UUID but does not exist', async () => {
      const res = await request(app)
        .post('/api/device-models')
        .send({ vendorId: GHOST_ID, model: 'UniFi AP', deviceType: 'RADIO' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('409 — duplicate vendorId+model returns 409', async () => {
      await request(app)
        .post('/api/device-models')
        .send({ vendorId: postVendorId, model: 'EdgeRouter X', deviceType: 'ROUTER' });

      const second = await request(app)
        .post('/api/device-models')
        .send({ vendorId: postVendorId, model: 'EdgeRouter X', deviceType: 'ROUTER' });

      expect(second.status).toBe(409);
      expect(second.body.success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PUT /api/device-models/:id
  // ─────────────────────────────────────────────────────────────

  describe('PUT /api/device-models/:id', () => {
    let putVendorId: string;
    let putModelId: string;

    beforeEach(async () => {
      await cleanCatalog(prisma);
      putVendorId = await seedVendor(prisma, { name: 'Cisco', slug: 'cisco-put' });

      const created = await request(app)
        .post('/api/device-models')
        .send({ vendorId: putVendorId, model: 'Catalyst 9200', deviceType: 'SWITCH' });

      putModelId = created.body.data.id as string;
    });

    it('200 — updates the model name', async () => {
      const res = await request(app)
        .put(`/api/device-models/${putModelId}`)
        .send({ model: 'Catalyst 9300' });

      expect(res.status).toBe(200);
      expect(res.body.data.model).toBe('Catalyst 9300');
      expect(res.body.data.deviceType).toBe('SWITCH');
    });

    it('400 — empty body returns 400', async () => {
      const res = await request(app)
        .put(`/api/device-models/${putModelId}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('404 — GHOST_ID not found', async () => {
      const res = await request(app)
        .put(`/api/device-models/${GHOST_ID}`)
        .send({ model: 'Ghost Model' });

      expect(res.status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /api/device-models/:id
  // ─────────────────────────────────────────────────────────────

  describe('DELETE /api/device-models/:id', () => {
    let deleteVendorId: string;
    let deleteModelId: string;

    beforeEach(async () => {
      await cleanCatalog(prisma);
      deleteVendorId = await seedVendor(prisma, { name: 'Juniper', slug: 'juniper-del' });

      const created = await request(app)
        .post('/api/device-models')
        .send({ vendorId: deleteVendorId, model: 'EX2300', deviceType: 'SWITCH' });

      deleteModelId = created.body.data.id as string;
    });

    it('204 — deletes successfully', async () => {
      const res = await request(app).delete(`/api/device-models/${deleteModelId}`);

      expect(res.status).toBe(204);

      const check = await request(app).get(`/api/device-models/${deleteModelId}`);
      expect(check.status).toBe(404);
    });

    it('404 — GHOST_ID not found', async () => {
      const res = await request(app).delete(`/api/device-models/${GHOST_ID}`);

      expect(res.status).toBe(404);
    });

    it('409 — returns 409 when the model has associated devices', async () => {
      await prisma.device.create({
        data: {
          name: 'Associated Device',
          owner: 'COMPANY',
          status: 'ACTIVE',
          monitoringEnabled: false,
          deviceModelId: deleteModelId
        }
      });

      const res = await request(app).delete(`/api/device-models/${deleteModelId}`);

      expect(res.status).toBe(409);
    });
  });
});
