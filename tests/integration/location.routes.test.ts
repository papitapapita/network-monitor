import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanDatabase,
  seedLocation,
  seedDeviceModel,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Location Routes — /api/locations', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let token: string;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    token = await seedAndGetToken(app, prisma, 'ADMIN');
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/locations
  // ─────────────────────────────────────────────────────────────

  describe('POST /api/locations', () => {
    it('201 — creates a location with required fields only', async () => {
      const res = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tower Norte', type: 'TOWER' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        name: 'Tower Norte',
        type: 'TOWER',
        latitude: null,
        longitude: null
      });
      expect(res.body.data.id).toBeDefined();
    });

    it('201 — creates a location with all optional fields', async () => {
      const res = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Datacenter SP',
          type: 'DATACENTER',
          municipality: 'São Paulo',
          neighborhood: 'Centro',
          address: 'Av. Paulista, 1000',
          latitude: -23.5505,
          longitude: -46.6333,
          altitude: 760
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        name: 'Datacenter SP',
        type: 'DATACENTER',
        municipality: 'São Paulo',
        neighborhood: 'Centro'
      });
    });

    it('[DEV-099] 400 — rejects missing name', async () => {
      const res = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'TOWER' });

      expect(res.status).toBe(400);
    });

    it('[DEV-099] 400 — rejects missing type', async () => {
      const res = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tower Norte' });

      expect(res.status).toBe(400);
    });

    it('[DEV-091] 400 — rejects invalid location type', async () => {
      const res = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tower Norte', type: 'INVALID_TYPE' });

      expect(res.status).toBe(400);
    });

    it('[DEV-092] 400 — rejects latitude without longitude', async () => {
      const res = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Tower Norte',
          type: 'TOWER',
          latitude: -23.55
        });

      expect(res.status).toBe(400);
    });

    it('[DEV-092] 400 — rejects longitude without latitude', async () => {
      const res = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Tower Norte',
          type: 'TOWER',
          longitude: -46.63
        });

      expect(res.status).toBe(400);
    });

    it('[DEV-140] 401 — rejects request with no token', async () => {
      const res = await request(app)
        .post('/api/locations')
        .send({ name: 'Tower Norte', type: 'TOWER' });

      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/locations
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/locations', () => {
    it('200 — returns empty list when no locations exist', async () => {
      const res = await request(app)
        .get('/api/locations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.hasMore).toBe(false);
    });

    it('200 — returns created locations', async () => {
      await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tower A', type: 'TOWER' });
      await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Office B', type: 'OFFICE' });

      const res = await request(app)
        .get('/api/locations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
    });

    it('200 — filters by type', async () => {
      await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tower A', type: 'TOWER' });
      await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Office B', type: 'OFFICE' });

      const res = await request(app)
        .get('/api/locations?type=TOWER')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.locations[0].type).toBe('TOWER');
    });

    it('200 — paginates with limit and offset', async () => {
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post('/api/locations')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: `Location ${i}`, type: 'POINT_OF_PRESENCE' });
      }

      const res = await request(app)
        .get('/api/locations?limit=2&offset=0')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.locations).toHaveLength(2);
      expect(res.body.data.hasMore).toBe(true);
    });

    it('400 — rejects invalid limit', async () => {
      const res = await request(app)
        .get('/api/locations?limit=0')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/locations/:id
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/locations/:id', () => {
    it('200 — returns an existing location', async () => {
      const create = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Datacenter Central', type: 'DATACENTER' });
      const id = create.body.data.id as string;

      const res = await request(app)
        .get(`/api/locations/${id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);
      expect(res.body.data.name).toBe('Datacenter Central');
    });

    it('404 — returns not found for unknown UUID', async () => {
      const res = await request(app)
        .get(`/api/locations/${GHOST_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('400 — returns bad request for invalid UUID', async () => {
      const res = await request(app)
        .get(`/api/locations/${INVALID_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /api/locations/:id
  // ─────────────────────────────────────────────────────────────

  describe('PATCH /api/locations/:id', () => {
    it('200 — updates selected fields', async () => {
      const create = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Office HQ', type: 'OFFICE' });
      const id = create.body.data.id as string;

      const res = await request(app)
        .patch(`/api/locations/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Office HQ Renamed',
          address: 'Av. Central 100',
          municipality: 'Bogotá',
          neighborhood: 'Chapinero'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Office HQ Renamed');
      expect(res.body.data.municipality).toBe('Bogotá');
      expect(res.body.data.type).toBe('OFFICE');
    });

    it('200 — clears optional fields with null', async () => {
      const create = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'POP Site',
          type: 'POINT_OF_PRESENCE',
          address: 'Calle 10',
          municipality: 'Medellín',
          neighborhood: 'Poblado'
        });
      const id = create.body.data.id as string;

      const res = await request(app)
        .patch(`/api/locations/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          address: null,
          municipality: null,
          neighborhood: null
        });

      expect(res.status).toBe(200);
      expect(res.body.data.municipality).toBeNull();
    });

    it('404 — returns not found for unknown UUID', async () => {
      const res = await request(app)
        .patch(`/api/locations/${GHOST_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Ghost Location' });

      expect(res.status).toBe(404);
    });

    it('[DEV-092] 400 — rejects unpaired coordinate update', async () => {
      const create = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tower', type: 'TOWER' });
      const id = create.body.data.id as string;

      const res = await request(app)
        .patch(`/api/locations/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ latitude: -23.55 });

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /api/locations/:id
  // ─────────────────────────────────────────────────────────────

  describe('DELETE /api/locations/:id', () => {
    it('204 — deletes a location with no devices', async () => {
      const locationId = await seedLocation(prisma);

      const res = await request(app)
        .delete(`/api/locations/${locationId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
    });

    it('204 — location is no longer returned by GET after deletion', async () => {
      const locationId = await seedLocation(prisma);

      await request(app)
        .delete(`/api/locations/${locationId}`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .get(`/api/locations/${locationId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('404 — returns not found for unknown UUID', async () => {
      const res = await request(app)
        .delete(`/api/locations/${GHOST_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('400 — returns bad request for invalid UUID', async () => {
      const res = await request(app)
        .delete(`/api/locations/${INVALID_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it('[DEV-097] 409 — returns conflict when devices are assigned to the location', async () => {
      const locationId = await seedLocation(prisma);
      const deviceModelId = await seedDeviceModel(prisma);

      await prisma.device.create({
        data: {
          name: 'CPE-001',
          status: 'ACTIVE',
          owner: 'COMPANY',
          monitoringEnabled: false,
          locationId,
          deviceModelId,
          ipAddress: '10.0.0.1'
        }
      });

      const res = await request(app)
        .delete(`/api/locations/${locationId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Cannot delete/i);
    });

    it('[DEV-140] 401 — rejects request with no token', async () => {
      const locationId = await seedLocation(prisma);

      const res = await request(app).delete(
        `/api/locations/${locationId}`
      );

      expect(res.status).toBe(401);
    });

    it('[DEV-141] 403 — VIEWER cannot delete a location', async () => {
      const locationId = await seedLocation(prisma);
      const viewerToken = await seedAndGetToken(
        app,
        prisma,
        'VIEWER'
      );

      const res = await request(app)
        .delete(`/api/locations/${locationId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
