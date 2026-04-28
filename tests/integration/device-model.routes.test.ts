import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { seedDeviceModel, GHOST_ID, INVALID_ID } from './helpers/db';
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
      expect(res.body.data.manufacturer).toBe('MIKROTIK');
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
});
