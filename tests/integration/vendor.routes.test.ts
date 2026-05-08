// Source: src/presentation/http/routes/vendor.routes.ts
// Tests the full HTTP stack for vendor CRUD via supertest against a real Postgres DB.

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { cleanCatalog, seedVendor, GHOST_ID, INVALID_ID } from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Vendor Routes — /api/vendors', () => {
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
    await cleanCatalog(prisma);
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/vendors
  // ─────────────────────────────────────────────────────────────

  describe('POST /api/vendors', () => {
    it('201 — creates a vendor with name and slug only', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .send({ name: 'Ubiquiti', slug: 'ubiquiti' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        name: 'Ubiquiti',
        slug: 'ubiquiti',
        description: null
      });
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.createdAt).toBeDefined();
      expect(res.body.data.updatedAt).toBeDefined();
    });

    it('201 — creates a vendor with an optional description', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .send({ name: 'TP-Link', slug: 'tp-link', description: 'Networking gear' });

      expect(res.status).toBe(201);
      expect(res.body.data.description).toBe('Networking gear');
    });

    it('400 — rejects missing name', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .send({ slug: 'no-name' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects missing slug', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .send({ name: 'No Slug Vendor' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects slug with uppercase letters', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .send({ name: 'Bad Slug', slug: 'Bad-Slug' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects slug with spaces', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .send({ name: 'Bad Slug', slug: 'bad slug' });

      expect(res.status).toBe(400);
    });

    it('409 — returns conflict on duplicate slug', async () => {
      await request(app)
        .post('/api/vendors')
        .send({ name: 'Cisco', slug: 'cisco' });

      const second = await request(app)
        .post('/api/vendors')
        .send({ name: 'Cisco Systems', slug: 'cisco' });

      expect(second.status).toBe(409);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/vendors
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/vendors', () => {
    it('200 — returns a list including the seeded vendor', async () => {
      await seedVendor(prisma, { name: 'MikroTik', slug: 'mikrotik' });

      const res = await request(app).get('/api/vendors');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.vendors)).toBe(true);
    });

    it('200 — includes pagination fields in the response', async () => {
      await seedVendor(prisma);

      const res = await request(app).get('/api/vendors');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('hasMore');
      expect(res.body.data).toHaveProperty('limit');
      expect(res.body.data).toHaveProperty('offset');
    });

    it('400 — rejects limit=0', async () => {
      const res = await request(app).get('/api/vendors?limit=0');

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/vendors/:id
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/vendors/:id', () => {
    it('200 — returns the vendor by id', async () => {
      const vendorId = await seedVendor(prisma, { name: 'Juniper', slug: 'juniper' });

      const res = await request(app).get(`/api/vendors/${vendorId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(vendorId);
      expect(res.body.data.name).toBe('Juniper');
      expect(res.body.data.slug).toBe('juniper');
    });

    it('404 — returns not found for GHOST_ID', async () => {
      const res = await request(app).get(`/api/vendors/${GHOST_ID}`);

      expect(res.status).toBe(404);
    });

    it('400 — returns bad request for INVALID_ID', async () => {
      const res = await request(app).get(`/api/vendors/${INVALID_ID}`);

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PUT /api/vendors/:id
  // ─────────────────────────────────────────────────────────────

  describe('PUT /api/vendors/:id', () => {
    it('200 — updates the vendor name', async () => {
      const vendorId = await seedVendor(prisma, { name: 'Old Name', slug: 'old-name' });

      const res = await request(app)
        .put(`/api/vendors/${vendorId}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('New Name');
      expect(res.body.data.slug).toBe('old-name');
    });

    it('200 — updates description to null', async () => {
      const vendorId = await seedVendor(prisma, {
        name: 'With Desc',
        slug: 'with-desc',
        description: 'Some description'
      });

      const res = await request(app)
        .put(`/api/vendors/${vendorId}`)
        .send({ description: null });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBeNull();
    });

    it('404 — returns not found for GHOST_ID', async () => {
      const res = await request(app)
        .put(`/api/vendors/${GHOST_ID}`)
        .send({ name: 'Ghost Vendor' });

      expect(res.status).toBe(404);
    });

    it('400 — empty body (no fields) returns 400', async () => {
      const vendorId = await seedVendor(prisma);

      const res = await request(app)
        .put(`/api/vendors/${vendorId}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('409 — slug conflict returns 409', async () => {
      await seedVendor(prisma, { name: 'First', slug: 'first-vendor' });
      const secondId = await seedVendor(prisma, { name: 'Second', slug: 'second-vendor' });

      const res = await request(app)
        .put(`/api/vendors/${secondId}`)
        .send({ slug: 'first-vendor' });

      expect(res.status).toBe(409);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /api/vendors/:id
  // ─────────────────────────────────────────────────────────────

  describe('DELETE /api/vendors/:id', () => {
    it('204 — deletes successfully', async () => {
      const vendorId = await seedVendor(prisma);

      const res = await request(app).delete(`/api/vendors/${vendorId}`);

      expect(res.status).toBe(204);

      const check = await request(app).get(`/api/vendors/${vendorId}`);
      expect(check.status).toBe(404);
    });

    it('404 — returns not found for GHOST_ID', async () => {
      const res = await request(app).delete(`/api/vendors/${GHOST_ID}`);

      expect(res.status).toBe(404);
    });

    it('409 — cannot delete vendor that has device models', async () => {
      const vendorId = await seedVendor(prisma, { name: 'Locked Vendor', slug: 'locked-vendor' });

      await prisma.deviceModel.create({
        data: {
          vendorId,
          model: 'SomeModel',
          deviceType: 'ROUTER'
        }
      });

      const res = await request(app).delete(`/api/vendors/${vendorId}`);

      expect(res.status).toBe(409);
    });
  });
});
