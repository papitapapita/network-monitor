// Source: src/presentation/http/routes/contracted-service.routes.ts
// Tests the full HTTP stack for contracted-service management via supertest against a real Postgres DB.

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanCustomers,
  cleanCatalog,
  seedCustomer,
  seedServicePlan,
  seedDeviceModel,
  seedDevice,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Contracted Service Routes — /api/contracted-services', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let token: string;

  let customerId: string;
  let servicePlanId: string;

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
    await cleanCatalog(prisma);
    token = await seedAndGetToken(app, prisma, 'ADMIN');
    customerId = await seedCustomer(prisma, { phone: '3001234567' });
    servicePlanId = await seedServicePlan(prisma);
  });

  async function seedDeviceId(): Promise<string> {
    const modelId = await seedDeviceModel(prisma);
    return seedDevice(prisma, modelId);
  }

  describe('POST /api/contracted-services', () => {
    it('201 — creates a PENDING service without a device', async () => {
      const res = await request(app)
        .post('/api/contracted-services')
        .set('Authorization', auth())
        .send({ customerId, servicePlanId });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        customerId,
        servicePlanId,
        deviceId: null,
        status: 'PENDING'
      });
    });

    it('201 — creates a service bonded to a device', async () => {
      const deviceId = await seedDeviceId();
      const res = await request(app)
        .post('/api/contracted-services')
        .set('Authorization', auth())
        .send({ customerId, servicePlanId, deviceId });

      expect(res.status).toBe(201);
      expect(res.body.data.deviceId).toBe(deviceId);
    });

    it('400 — rejects a malformed customerId', async () => {
      const res = await request(app)
        .post('/api/contracted-services')
        .set('Authorization', auth())
        .send({ customerId: INVALID_ID, servicePlanId });
      expect(res.status).toBe(400);
    });

    it('404 — customer does not exist', async () => {
      const res = await request(app)
        .post('/api/contracted-services')
        .set('Authorization', auth())
        .send({ customerId: GHOST_ID, servicePlanId });
      expect(res.status).toBe(404);
    });

    it('404 — service plan does not exist', async () => {
      const res = await request(app)
        .post('/api/contracted-services')
        .set('Authorization', auth())
        .send({ customerId, servicePlanId: GHOST_ID });
      expect(res.status).toBe(404);
    });

    it('409 — device already assigned to another service', async () => {
      const deviceId = await seedDeviceId();
      await request(app)
        .post('/api/contracted-services')
        .set('Authorization', auth())
        .send({ customerId, servicePlanId, deviceId });

      const second = await request(app)
        .post('/api/contracted-services')
        .set('Authorization', auth())
        .send({ customerId, servicePlanId, deviceId });

      expect(second.status).toBe(409);
    });
  });

  describe('GET /api/contracted-services', () => {
    it('200 — lists services and filters by customerId', async () => {
      await request(app)
        .post('/api/contracted-services')
        .set('Authorization', auth())
        .send({ customerId, servicePlanId });

      const all = await request(app)
        .get('/api/contracted-services')
        .set('Authorization', auth());
      expect(all.status).toBe(200);
      expect(all.body.data.total).toBeGreaterThanOrEqual(1);

      const filtered = await request(app)
        .get(`/api/contracted-services?customerId=${customerId}`)
        .set('Authorization', auth());
      expect(filtered.status).toBe(200);
      expect(
        filtered.body.data.contractedServices.every(
          (s: { customerId: string }) => s.customerId === customerId
        )
      ).toBe(true);
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .get(`/api/contracted-services/${GHOST_ID}`)
        .set('Authorization', auth());
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/contracted-services/:id', () => {
    async function createService(deviceId?: string): Promise<string> {
      const res = await request(app)
        .post('/api/contracted-services')
        .set('Authorization', auth())
        .send({ customerId, servicePlanId, deviceId });
      return res.body.data.id;
    }

    it('200 — assigns a device and activates in one call', async () => {
      const id = await createService();
      const deviceId = await seedDeviceId();

      const res = await request(app)
        .put(`/api/contracted-services/${id}`)
        .set('Authorization', auth())
        .send({ deviceId, status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.deviceId).toBe(deviceId);
    });

    it('409 — cannot activate without a device', async () => {
      const id = await createService();
      const res = await request(app)
        .put(`/api/contracted-services/${id}`)
        .set('Authorization', auth())
        .send({ status: 'ACTIVE' });
      expect(res.status).toBe(409);
    });

    it('400 — rejects an invalid target status', async () => {
      const id = await createService();
      const res = await request(app)
        .put(`/api/contracted-services/${id}`)
        .set('Authorization', auth())
        .send({ status: 'PENDING' });
      expect(res.status).toBe(400);
    });

    it('409 — cannot modify a cancelled service', async () => {
      const id = await createService();
      await request(app)
        .put(`/api/contracted-services/${id}`)
        .set('Authorization', auth())
        .send({ status: 'CANCELLED' });

      const res = await request(app)
        .put(`/api/contracted-services/${id}`)
        .set('Authorization', auth())
        .send({ status: 'SUSPENDED' });
      expect(res.status).toBe(409);
    });

    it('200 — suspends an active service and releases its device', async () => {
      const deviceId = await seedDeviceId();
      const id = await createService(deviceId);
      await request(app)
        .put(`/api/contracted-services/${id}`)
        .set('Authorization', auth())
        .send({ status: 'ACTIVE' });

      const res = await request(app)
        .put(`/api/contracted-services/${id}`)
        .set('Authorization', auth())
        .send({ status: 'SUSPENDED', deviceId: null });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SUSPENDED');
      expect(res.body.data.deviceId).toBeNull();
    });
  });

  describe('DELETE /api/contracted-services/:id', () => {
    it('204 — deletes a service', async () => {
      const created = await request(app)
        .post('/api/contracted-services')
        .set('Authorization', auth())
        .send({ customerId, servicePlanId });

      const res = await request(app)
        .delete(`/api/contracted-services/${created.body.data.id}`)
        .set('Authorization', auth());
      expect(res.status).toBe(204);
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .delete(`/api/contracted-services/${GHOST_ID}`)
        .set('Authorization', auth());
      expect(res.status).toBe(404);
    });
  });
});
