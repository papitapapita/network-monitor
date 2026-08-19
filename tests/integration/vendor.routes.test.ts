// Source: src/presentation/http/routes/vendor.routes.ts
// Tests the full HTTP stack for vendor CRUD via supertest against a real Postgres DB.

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import {
  cleanCatalog,
  seedVendor,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Vendor Routes — /api/vendors', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adminToken: string;
  let viewerToken: string;

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
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/vendors
  // ─────────────────────────────────────────────────────────────

  describe('POST /api/vendors', () => {
    it('201 — creates a vendor with name and slug only', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
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

      const row = await prisma.vendor.findUnique({
        where: { slug: 'ubiquiti' }
      });
      expect(row!.name).toBe('Ubiquiti');
    });

    it('201 — creates a vendor with an optional description', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'TP-Link',
          slug: 'tp-link',
          description: 'Networking gear'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.description).toBe('Networking gear');
    });

    it('401 — rejects an unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .send({ name: 'Ubiquiti', slug: 'ubiquiti' });

      expect(res.status).toBe(401);
    });

    it('403 — rejects a VIEWER creating a vendor', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Ubiquiti', slug: 'ubiquiti' });

      expect(res.status).toBe(403);
    });

    it('[DEV-001] 201 — accepts a name of exactly 100 characters', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'A'.repeat(100), slug: 'hundred-char-name' });

      expect(res.status).toBe(201);
    });

    it('[DEV-001] 400 — rejects a name longer than 100 characters', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'A'.repeat(101), slug: 'too-long-name' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('[DEV-002] 201 — accepts a slug of lowercase letters, digits and hyphens', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Mimosa B5', slug: 'mimosa-b5' });

      expect(res.status).toBe(201);
      expect(res.body.data.slug).toBe('mimosa-b5');
    });

    it('[DEV-002] 400 — rejects slug with uppercase letters', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Bad Slug', slug: 'Bad-Slug' });

      expect(res.status).toBe(400);
    });

    it('[DEV-002] 400 — rejects slug with spaces', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Bad Slug', slug: 'bad slug' });

      expect(res.status).toBe(400);
    });

    it('[DEV-004] 201 — accepts a description of exactly 500 characters', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Verbose',
          slug: 'verbose',
          description: 'D'.repeat(500)
        });

      expect(res.status).toBe(201);
    });

    it('[DEV-004] 400 — rejects a description longer than 500 characters', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Verbose',
          slug: 'too-verbose',
          description: 'D'.repeat(501)
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('[DEV-006] 400 — rejects missing name', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ slug: 'no-name' });

      expect(res.status).toBe(400);
    });

    it('[DEV-006] 400 — rejects missing slug', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'No Slug Vendor' });

      expect(res.status).toBe(400);
    });

    it('[DEV-006] 400 — rejects a body with neither name nor slug', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Nothing else' });

      expect(res.status).toBe(400);
    });

    it('[DEV-003] 409 — returns conflict on duplicate slug', async () => {
      await seedVendor(prisma, { name: 'Cisco', slug: 'cisco' });

      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Cisco Systems', slug: 'cisco' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/vendors
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/vendors', () => {
    it('200 — returns a list including the seeded vendor', async () => {
      await seedVendor(prisma, {
        name: 'MikroTik',
        slug: 'mikrotik'
      });

      const res = await request(app)
        .get('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.vendors)).toBe(true);
    });

    it('200 — includes pagination fields in the response', async () => {
      await seedVendor(prisma);

      const res = await request(app)
        .get('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('hasMore');
      expect(res.body.data).toHaveProperty('limit');
      expect(res.body.data).toHaveProperty('offset');
    });

    it('200 — a VIEWER may read the list', async () => {
      await seedVendor(prisma);

      const res = await request(app)
        .get('/api/vendors')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
    });

    it('400 — rejects limit=0', async () => {
      const res = await request(app)
        .get('/api/vendors?limit=0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('401 — rejects an unauthenticated request', async () => {
      const res = await request(app).get('/api/vendors');

      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/vendors/:id
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/vendors/:id', () => {
    it('200 — returns the vendor by id', async () => {
      const vendorId = await seedVendor(prisma, {
        name: 'Juniper',
        slug: 'juniper'
      });

      const res = await request(app)
        .get(`/api/vendors/${vendorId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(vendorId);
      expect(res.body.data.name).toBe('Juniper');
      expect(res.body.data.slug).toBe('juniper');
    });

    it('404 — returns not found for GHOST_ID', async () => {
      const res = await request(app)
        .get(`/api/vendors/${GHOST_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('400 — returns bad request for INVALID_ID', async () => {
      const res = await request(app)
        .get(`/api/vendors/${INVALID_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('401 — rejects an unauthenticated request', async () => {
      const vendorId = await seedVendor(prisma);

      const res = await request(app).get(`/api/vendors/${vendorId}`);

      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PUT /api/vendors/:id
  // ─────────────────────────────────────────────────────────────

  describe('PUT /api/vendors/:id', () => {
    it('200 — updates the vendor name', async () => {
      const vendorId = await seedVendor(prisma, {
        name: 'Old Name',
        slug: 'old-name'
      });

      const res = await request(app)
        .put(`/api/vendors/${vendorId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('New Name');
      expect(res.body.data.slug).toBe('old-name');

      const row = await prisma.vendor.findUnique({
        where: { id: vendorId }
      });
      expect(row!.name).toBe('New Name');
    });

    it('200 — updates description to null', async () => {
      const vendorId = await seedVendor(prisma, {
        name: 'With Desc',
        slug: 'with-desc',
        description: 'Some description'
      });

      const res = await request(app)
        .put(`/api/vendors/${vendorId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: null });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBeNull();
    });

    it('[DEV-001] 400 — rejects a name longer than 100 characters', async () => {
      const vendorId = await seedVendor(prisma);

      const res = await request(app)
        .put(`/api/vendors/${vendorId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'A'.repeat(101) });

      expect(res.status).toBe(400);
    });

    it('[DEV-002] 400 — rejects an invalid slug', async () => {
      const vendorId = await seedVendor(prisma);

      const res = await request(app)
        .put(`/api/vendors/${vendorId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ slug: 'Not A Slug' });

      expect(res.status).toBe(400);
    });

    it('[DEV-003] 409 — slug conflict returns 409', async () => {
      await seedVendor(prisma, {
        name: 'First',
        slug: 'first-vendor'
      });
      const secondId = await seedVendor(prisma, {
        name: 'Second',
        slug: 'second-vendor'
      });

      const res = await request(app)
        .put(`/api/vendors/${secondId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ slug: 'first-vendor' });

      expect(res.status).toBe(409);
    });

    it('400 — empty body (no fields) returns 400', async () => {
      const vendorId = await seedVendor(prisma);

      const res = await request(app)
        .put(`/api/vendors/${vendorId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('404 — returns not found for GHOST_ID', async () => {
      const res = await request(app)
        .put(`/api/vendors/${GHOST_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Ghost Vendor' });

      expect(res.status).toBe(404);
    });

    it('400 — returns bad request for INVALID_ID', async () => {
      const res = await request(app)
        .put(`/api/vendors/${INVALID_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Whatever' });

      expect(res.status).toBe(400);
    });

    it('401 — rejects an unauthenticated request', async () => {
      const vendorId = await seedVendor(prisma);

      const res = await request(app)
        .put(`/api/vendors/${vendorId}`)
        .send({ name: 'Nope' });

      expect(res.status).toBe(401);
    });

    it('403 — rejects a VIEWER updating a vendor', async () => {
      const vendorId = await seedVendor(prisma);

      const res = await request(app)
        .put(`/api/vendors/${vendorId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Nope' });

      expect(res.status).toBe(403);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /api/vendors/:id
  // ─────────────────────────────────────────────────────────────

  describe('DELETE /api/vendors/:id', () => {
    it('204 — deletes successfully', async () => {
      const vendorId = await seedVendor(prisma);

      const res = await request(app)
        .delete(`/api/vendors/${vendorId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);

      const check = await request(app)
        .get(`/api/vendors/${vendorId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(check.status).toBe(404);
    });

    it('[DEV-008] 404 — returns not found for GHOST_ID', async () => {
      const res = await request(app)
        .delete(`/api/vendors/${GHOST_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('400 — returns bad request for INVALID_ID', async () => {
      const res = await request(app)
        .delete(`/api/vendors/${INVALID_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('[DEV-005] 409 — cannot delete vendor that has device models', async () => {
      const vendorId = await seedVendor(prisma, {
        name: 'Locked Vendor',
        slug: 'locked-vendor'
      });
      await prisma.deviceModel.create({
        data: { vendorId, model: 'SomeModel', deviceType: 'ROUTER' }
      });

      const res = await request(app)
        .delete(`/api/vendors/${vendorId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);

      const row = await prisma.vendor.findUnique({
        where: { id: vendorId }
      });
      expect(row).not.toBeNull();
    });

    it('401 — rejects an unauthenticated request', async () => {
      const vendorId = await seedVendor(prisma);

      const res = await request(app).delete(
        `/api/vendors/${vendorId}`
      );

      expect(res.status).toBe(401);
    });

    it('403 — rejects a VIEWER deleting a vendor', async () => {
      const vendorId = await seedVendor(prisma);

      const res = await request(app)
        .delete(`/api/vendors/${vendorId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
