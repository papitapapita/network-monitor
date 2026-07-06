// Source: src/presentation/http/routes/customer.routes.ts
// Tests the full HTTP stack for customer CRUD via supertest against a real Postgres DB.

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanCustomers,
  seedCustomer,
  seedServicePlan,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Customer Routes — /api/customers', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let token: string;

  const auth = () => `Bearer ${token}`;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCustomers(prisma);
    token = await seedAndGetToken(app, prisma, 'ADMIN');
  });

  describe('POST /api/customers', () => {
    it('201 — creates a customer with required fields only', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', auth())
        .send({ fullName: 'Juan Perez', phone: '3001234567' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        fullName: 'Juan Perez',
        phone: '3001234567',
        email: null,
        cedula: null
      });
      expect(res.body.data.id).toBeDefined();
    });

    it('201 — normalizes phone and lowercases email', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', auth())
        .send({
          fullName: 'Ana Gomez',
          phone: '300 123 9999',
          email: 'Ana@Example.COM',
          cedula: '1.036.612'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.phone).toBe('3001239999');
      expect(res.body.data.email).toBe('ana@example.com');
      expect(res.body.data.cedula).toBe('1036612');
    });

    it('400 — rejects a missing name', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', auth())
        .send({ phone: '3001234567' });
      expect(res.status).toBe(400);
    });

    it('400 — rejects an invalid phone', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', auth())
        .send({ fullName: 'Bad Phone', phone: '12' });
      expect(res.status).toBe(400);
    });

    it('400 — rejects an invalid email', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', auth())
        .send({
          fullName: 'Bad Email',
          phone: '3001234567',
          email: 'nope'
        });
      expect(res.status).toBe(400);
    });

    it('409 — returns conflict on duplicate phone', async () => {
      await request(app)
        .post('/api/customers')
        .set('Authorization', auth())
        .send({ fullName: 'First', phone: '3001112222' });

      const second = await request(app)
        .post('/api/customers')
        .set('Authorization', auth())
        .send({ fullName: 'Second', phone: '3001112222' });

      expect(second.status).toBe(409);
    });

    it('401 — rejects an unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/customers')
        .send({ fullName: 'NoAuth', phone: '3001234567' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/customers', () => {
    it('200 — returns a paginated list', async () => {
      await seedCustomer(prisma, { phone: '3001234567' });
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.customers)).toBe(true);
    });
  });

  describe('GET /api/customers/:id', () => {
    it('200 — returns a customer by id', async () => {
      const id = await seedCustomer(prisma, { phone: '3007778888' });
      const res = await request(app)
        .get(`/api/customers/${id}`)
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .get(`/api/customers/${GHOST_ID}`)
        .set('Authorization', auth());
      expect(res.status).toBe(404);
    });

    it('400 — malformed id', async () => {
      const res = await request(app)
        .get(`/api/customers/${INVALID_ID}`)
        .set('Authorization', auth());
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/customers/:id', () => {
    it('200 — renames a customer', async () => {
      const id = await seedCustomer(prisma, { phone: '3009990000' });
      const res = await request(app)
        .put(`/api/customers/${id}`)
        .set('Authorization', auth())
        .send({ fullName: 'Renamed Person' });

      expect(res.status).toBe(200);
      expect(res.body.data.fullName).toBe('Renamed Person');
    });

    it('409 — rejects a phone owned by another customer', async () => {
      await seedCustomer(prisma, {
        fullName: 'Owner',
        phone: '3001110000'
      });
      const id = await seedCustomer(prisma, {
        fullName: 'Mover',
        phone: '3002220000'
      });

      const res = await request(app)
        .put(`/api/customers/${id}`)
        .set('Authorization', auth())
        .send({ phone: '3001110000' });

      expect(res.status).toBe(409);
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .put(`/api/customers/${GHOST_ID}`)
        .set('Authorization', auth())
        .send({ fullName: 'X' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/customers/:id', () => {
    it('204 — deletes a customer with no services', async () => {
      const id = await seedCustomer(prisma, { phone: '3004445555' });
      const res = await request(app)
        .delete(`/api/customers/${id}`)
        .set('Authorization', auth());
      expect(res.status).toBe(204);
    });

    it('409 — refuses to delete a customer with a contracted service', async () => {
      const customerId = await seedCustomer(prisma, {
        phone: '3006667777'
      });
      const servicePlanId = await seedServicePlan(prisma);
      await prisma.contractedService.create({
        data: {
          customerId,
          servicePlanId,
          status: 'PENDING',
          startDate: new Date()
        }
      });

      const res = await request(app)
        .delete(`/api/customers/${customerId}`)
        .set('Authorization', auth());
      expect(res.status).toBe(409);
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .delete(`/api/customers/${GHOST_ID}`)
        .set('Authorization', auth());
      expect(res.status).toBe(404);
    });
  });
});
