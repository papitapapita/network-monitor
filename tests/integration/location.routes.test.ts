import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { cleanDatabase, GHOST_ID, INVALID_ID } from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Location Routes — /api/locations', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/locations
  // ─────────────────────────────────────────────────────────────

  describe('POST /api/locations', () => {
    it('201 — creates a location with required fields only', async () => {
      const res = await request(app)
        .post('/api/locations')
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

    it('400 — rejects missing name', async () => {
      const res = await request(app)
        .post('/api/locations')
        .send({ type: 'TOWER' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects missing type', async () => {
      const res = await request(app)
        .post('/api/locations')
        .send({ name: 'Tower Norte' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects invalid location type', async () => {
      const res = await request(app)
        .post('/api/locations')
        .send({ name: 'Tower Norte', type: 'INVALID_TYPE' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects latitude without longitude', async () => {
      const res = await request(app)
        .post('/api/locations')
        .send({ name: 'Tower Norte', type: 'TOWER', latitude: -23.55 });

      expect(res.status).toBe(400);
    });

    it('400 — rejects longitude without latitude', async () => {
      const res = await request(app)
        .post('/api/locations')
        .send({ name: 'Tower Norte', type: 'TOWER', longitude: -46.63 });

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/locations
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/locations', () => {
    it('200 — returns empty list when no locations exist', async () => {
      const res = await request(app).get('/api/locations');

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.hasMore).toBe(false);
    });

    it('200 — returns created locations', async () => {
      await request(app)
        .post('/api/locations')
        .send({ name: 'Tower A', type: 'TOWER' });
      await request(app)
        .post('/api/locations')
        .send({ name: 'Node B', type: 'NODE' });

      const res = await request(app).get('/api/locations');

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
    });

    it('200 — filters by type', async () => {
      await request(app)
        .post('/api/locations')
        .send({ name: 'Tower A', type: 'TOWER' });
      await request(app)
        .post('/api/locations')
        .send({ name: 'Node B', type: 'NODE' });

      const res = await request(app).get('/api/locations?type=TOWER');

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.locations[0].type).toBe('TOWER');
    });

    it('200 — paginates with limit and offset', async () => {
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post('/api/locations')
          .send({ name: `Location ${i}`, type: 'POP' });
      }

      const res = await request(app).get('/api/locations?limit=2&offset=0');

      expect(res.status).toBe(200);
      expect(res.body.data.locations).toHaveLength(2);
      expect(res.body.data.hasMore).toBe(true);
    });

    it('400 — rejects invalid limit', async () => {
      const res = await request(app).get('/api/locations?limit=0');

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
        .send({ name: 'Warehouse Central', type: 'WAREHOUSE' });
      const id = create.body.data.id as string;

      const res = await request(app).get(`/api/locations/${id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);
      expect(res.body.data.name).toBe('Warehouse Central');
    });

    it('404 — returns not found for unknown UUID', async () => {
      const res = await request(app).get(`/api/locations/${GHOST_ID}`);

      expect(res.status).toBe(404);
    });

    it('400 — returns bad request for invalid UUID', async () => {
      const res = await request(app).get(`/api/locations/${INVALID_ID}`);

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
        .send({ name: 'Office HQ', type: 'OFFICE' });
      const id = create.body.data.id as string;

      const res = await request(app)
        .patch(`/api/locations/${id}`)
        .send({ name: 'Office HQ Renamed', municipality: 'Bogotá' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Office HQ Renamed');
      expect(res.body.data.municipality).toBe('Bogotá');
      expect(res.body.data.type).toBe('OFFICE');
    });

    it('200 — clears optional fields with null', async () => {
      const create = await request(app)
        .post('/api/locations')
        .send({ name: 'POP Site', type: 'POP', municipality: 'Medellín' });
      const id = create.body.data.id as string;

      const res = await request(app)
        .patch(`/api/locations/${id}`)
        .send({ municipality: null });

      expect(res.status).toBe(200);
      expect(res.body.data.municipality).toBeNull();
    });

    it('404 — returns not found for unknown UUID', async () => {
      const res = await request(app)
        .patch(`/api/locations/${GHOST_ID}`)
        .send({ name: 'Ghost Location' });

      expect(res.status).toBe(404);
    });

    it('400 — rejects unpaired coordinate update', async () => {
      const create = await request(app)
        .post('/api/locations')
        .send({ name: 'Tower', type: 'TOWER' });
      const id = create.body.data.id as string;

      const res = await request(app)
        .patch(`/api/locations/${id}`)
        .send({ latitude: -23.55 });

      expect(res.status).toBe(400);
    });
  });
});
