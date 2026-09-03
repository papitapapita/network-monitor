// Source: src/presentation/http/routes/service-plan.routes.ts
// Tests the full HTTP stack for service-plan CRUD via supertest against a real Postgres DB.

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

describe('Service Plan Routes — /api/service-plans', () => {
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

  describe('POST /api/service-plans', () => {
    it('201 — creates a plan, defaulting isActive to true', async () => {
      const res = await request(app)
        .post('/api/service-plans')
        .set('Authorization', auth())
        .send({
          name: 'Fibra 100/20',
          downloadMbps: 100,
          uploadMbps: 20,
          monthlyPrice: 120000
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        name: 'Fibra 100/20',
        downloadMbps: 100,
        uploadMbps: 20,
        monthlyPrice: 120000,
        isActive: true
      });
    });

    it('400 — rejects a negative price', async () => {
      const res = await request(app)
        .post('/api/service-plans')
        .set('Authorization', auth())
        .send({
          name: 'Bad Price',
          downloadMbps: 50,
          uploadMbps: 10,
          monthlyPrice: -1
        });
      expect(res.status).toBe(400);
    });

    it('400 — rejects non-positive bandwidth', async () => {
      const res = await request(app)
        .post('/api/service-plans')
        .set('Authorization', auth())
        .send({
          name: 'Bad Bandwidth',
          downloadMbps: 0,
          uploadMbps: 10,
          monthlyPrice: 1000
        });
      expect(res.status).toBe(400);
    });

    it('409 — returns conflict on duplicate name', async () => {
      await seedServicePlan(prisma, { name: 'Dup Plan' });
      const res = await request(app)
        .post('/api/service-plans')
        .set('Authorization', auth())
        .send({
          name: 'Dup Plan',
          downloadMbps: 50,
          uploadMbps: 10,
          monthlyPrice: 1000
        });
      expect(res.status).toBe(409);
    });

    it('[CUS-032] 409 — returns conflict when the name differs only in case', async () => {
      await seedServicePlan(prisma, { name: 'Dup Plan' });
      const res = await request(app)
        .post('/api/service-plans')
        .set('Authorization', auth())
        .send({
          name: 'dup plan',
          downloadMbps: 50,
          uploadMbps: 10,
          monthlyPrice: 1000
        });
      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/service-plans', () => {
    it('200 — lists plans', async () => {
      await seedServicePlan(prisma, { name: 'Listed Plan' });
      const res = await request(app)
        .get('/api/service-plans')
        .set('Authorization', auth());
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.servicePlans)).toBe(true);
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .get(`/api/service-plans/${GHOST_ID}`)
        .set('Authorization', auth());
      expect(res.status).toBe(404);
    });

    it('400 — malformed id', async () => {
      const res = await request(app)
        .get(`/api/service-plans/${INVALID_ID}`)
        .set('Authorization', auth());
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/service-plans/:id', () => {
    it('200 — deactivates a plan', async () => {
      const id = await seedServicePlan(prisma, {
        name: 'To Disable'
      });
      const res = await request(app)
        .put(`/api/service-plans/${id}`)
        .set('Authorization', auth())
        .send({ isActive: false });
      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('409 — rejects a name owned by another plan', async () => {
      await seedServicePlan(prisma, { name: 'Existing Name' });
      const id = await seedServicePlan(prisma, {
        name: 'Other Name'
      });
      const res = await request(app)
        .put(`/api/service-plans/${id}`)
        .set('Authorization', auth())
        .send({ name: 'Existing Name' });
      expect(res.status).toBe(409);
    });

    it('[CUS-032] 409 — rejects a name owned by another plan even when only the case differs', async () => {
      await seedServicePlan(prisma, { name: 'Existing Name' });
      const id = await seedServicePlan(prisma, {
        name: 'Other Name'
      });
      const res = await request(app)
        .put(`/api/service-plans/${id}`)
        .set('Authorization', auth())
        .send({ name: 'existing name' });
      expect(res.status).toBe(409);
    });

    it('[CUS-032] 200 — allows "renaming" a plan to a different case of its own name', async () => {
      const id = await seedServicePlan(prisma, { name: 'Own Name' });
      const res = await request(app)
        .put(`/api/service-plans/${id}`)
        .set('Authorization', auth())
        .send({ name: 'own name' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('own name');
    });
  });

  describe('DELETE /api/service-plans/:id', () => {
    it('204 — deletes an unreferenced plan', async () => {
      const id = await seedServicePlan(prisma, { name: 'Deletable' });
      const res = await request(app)
        .delete(`/api/service-plans/${id}`)
        .set('Authorization', auth());
      expect(res.status).toBe(204);
    });

    it('409 — refuses to delete a plan referenced by a contracted service', async () => {
      const customerId = await seedCustomer(prisma, {
        phone: '3008889999'
      });
      const servicePlanId = await seedServicePlan(prisma, {
        name: 'Referenced Plan'
      });
      await prisma.contractedService.create({
        data: {
          customerId,
          servicePlanId,
          status: 'PENDING',
          startDate: new Date()
        }
      });

      const res = await request(app)
        .delete(`/api/service-plans/${servicePlanId}`)
        .set('Authorization', auth());
      expect(res.status).toBe(409);
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .delete(`/api/service-plans/${GHOST_ID}`)
        .set('Authorization', auth());
      expect(res.status).toBe(404);
    });
  });
});
