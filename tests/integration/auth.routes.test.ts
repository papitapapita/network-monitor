import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { cleanDatabase } from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import { seedUser, seedAndGetToken } from './helpers/auth';
import { GHOST_ID } from './helpers/db';

const ADMIN_EMAIL = 'admin@test.local';
const ADMIN_PASS = 'admin-secret-pass';

describe('Auth Routes — /api/auth', () => {
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
  // POST /api/auth/login
  // ─────────────────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('200 — returns token and user payload on valid credentials', async () => {
      await seedUser(prisma, ADMIN_EMAIL, ADMIN_PASS, 'ADMIN');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASS });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.token).toBe('string');
      expect(res.body.data.token.length).toBeGreaterThan(0);
      expect(res.body.data.user.email).toBe(ADMIN_EMAIL);
      expect(res.body.data.user.role).toBe('ADMIN');
      expect(res.body.data.user.id).toBeDefined();
    });

    it('200 — user object does not include passwordHash', async () => {
      await seedUser(prisma, ADMIN_EMAIL, ADMIN_PASS, 'ADMIN');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASS });

      expect(res.status).toBe(200);
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('200 — preserves OPERATOR role in response', async () => {
      await seedUser(prisma, 'operator@test.local', 'op-pass', 'OPERATOR');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'operator@test.local', password: 'op-pass' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('OPERATOR');
    });

    it('200 — normalises email to lowercase before lookup', async () => {
      await seedUser(prisma, 'case@test.local', 'pass', 'VIEWER');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'CASE@TEST.LOCAL', password: 'pass' });

      expect(res.status).toBe(200);
    });

    it('401 — rejects wrong password', async () => {
      await seedUser(prisma, ADMIN_EMAIL, ADMIN_PASS, 'ADMIN');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('401 — rejects unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@test.local', password: 'whatever' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('401 — wrong-password and unknown-email return the same error message', async () => {
      await seedUser(prisma, ADMIN_EMAIL, ADMIN_PASS, 'ADMIN');

      const badPassRes = await request(app)
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: 'bad' });

      const unknownRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@test.local', password: 'pass' });

      expect(badPassRes.status).toBe(401);
      expect(unknownRes.status).toBe(401);
      expect(badPassRes.body.error).toBe(unknownRes.body.error);
    });

    it('400 — rejects missing email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: ADMIN_PASS });

      expect(res.status).toBe(400);
    });

    it('400 — rejects missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL });

      expect(res.status).toBe(400);
    });

    it('400 — rejects invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: ADMIN_PASS });

      expect(res.status).toBe(400);
    });

    it('400 — rejects empty body', async () => {
      const res = await request(app).post('/api/auth/login').send({});

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Authentication enforcement on protected routes
  // ─────────────────────────────────────────────────────────────

  describe('Authentication enforcement on protected routes', () => {
    it('401 — GET /api/locations without a token', async () => {
      const res = await request(app).get('/api/locations');

      expect(res.status).toBe(401);
    });

    it('401 — POST /api/locations without a token', async () => {
      const res = await request(app)
        .post('/api/locations')
        .send({ name: 'Tower', type: 'TOWER' });

      expect(res.status).toBe(401);
    });

    it('401 — returns 401 with a malformed Bearer token', async () => {
      const res = await request(app)
        .get('/api/locations')
        .set('Authorization', 'Bearer not.a.valid.jwt');

      expect(res.status).toBe(401);
    });

    it('401 — returns 401 with a non-Bearer Authorization scheme', async () => {
      const res = await request(app)
        .get('/api/locations')
        .set('Authorization', 'Basic dXNlcjpwYXNz');

      expect(res.status).toBe(401);
    });

    it('401 — GET /api/devices without a token', async () => {
      const res = await request(app).get('/api/devices');

      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Role-based authorization (RBAC)
  // ─────────────────────────────────────────────────────────────

  describe('Role-based authorization', () => {
    it('200 — ADMIN token allows GET /api/locations', async () => {
      const token = await seedAndGetToken(app, prisma, 'ADMIN');

      const res = await request(app)
        .get('/api/locations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('200 — VIEWER token allows GET /api/locations', async () => {
      const token = await seedAndGetToken(app, prisma, 'VIEWER');

      const res = await request(app)
        .get('/api/locations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('200 — OPERATOR token allows GET /api/locations', async () => {
      const token = await seedAndGetToken(app, prisma, 'OPERATOR');

      const res = await request(app)
        .get('/api/locations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('201 — ADMIN token allows POST /api/locations', async () => {
      const token = await seedAndGetToken(app, prisma, 'ADMIN');

      const res = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Admin Tower', type: 'TOWER' });

      expect(res.status).toBe(201);
    });

    it('201 — OPERATOR token allows POST /api/locations', async () => {
      const token = await seedAndGetToken(app, prisma, 'OPERATOR');

      const res = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Operator Tower', type: 'TOWER' });

      expect(res.status).toBe(201);
    });

    it('403 — VIEWER token blocks POST /api/locations', async () => {
      const token = await seedAndGetToken(app, prisma, 'VIEWER');

      const res = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Forbidden Tower', type: 'TOWER' });

      expect(res.status).toBe(403);
    });

    it('403 — VIEWER token blocks PATCH /api/locations/:id', async () => {
      const adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
      const create = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Target Location', type: 'NODE' });
      const id = create.body.data.id as string;

      const viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');

      const res = await request(app)
        .patch(`/api/locations/${id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Renamed' });

      expect(res.status).toBe(403);
    });

    it('403 — OPERATOR token blocks DELETE /api/vendors/:id', async () => {
      const opToken = await seedAndGetToken(app, prisma, 'OPERATOR');

      // authorize('delete') runs before the controller — OPERATOR gets 403 before any DB lookup
      const res = await request(app)
        .delete(`/api/vendors/${GHOST_ID}`)
        .set('Authorization', `Bearer ${opToken}`);

      expect(res.status).toBe(403);
    });

    it('404 — ADMIN token is not blocked by RBAC on DELETE /api/vendors/:id', async () => {
      const adminToken = await seedAndGetToken(app, prisma, 'ADMIN');

      // authorize passes for ADMIN → controller runs → 404 because vendor doesn't exist
      const res = await request(app)
        .delete(`/api/vendors/${GHOST_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).not.toBe(403);
      expect(res.status).toBe(404);
    });
  });
});
