// Source: src/presentation/http/routes/technician.routes.ts
// Tests the full HTTP stack for technician CRUD via supertest against a real Postgres DB.

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanTickets,
  seedTechnician,
  seedTicket,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Technician Routes — /api/technicians', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let token: string;
  let viewerToken: string;

  const auth = () => `Bearer ${token}`;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanTickets(prisma);
    token = await seedAndGetToken(app, prisma, 'ADMIN');
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
  });

  describe('authentication and authorization', () => {
    it('401 — rejects a request with no token', async () => {
      const res = await request(app).get('/api/technicians');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('403 — rejects a VIEWER creating a technician', async () => {
      const res = await request(app)
        .post('/api/technicians')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ fullName: 'Nope', phone: '+573001110000' });

      expect(res.status).toBe(403);
    });

    it('200 — allows a VIEWER to read', async () => {
      const res = await request(app)
        .get('/api/technicians')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/technicians', () => {
    it('201 — creates a technician, defaulting isActive to true', async () => {
      const res = await request(app)
        .post('/api/technicians')
        .set('Authorization', auth())
        .send({
          fullName: 'Andrés Muñoz',
          phone: '+573001112233',
          email: 'andres@isp.example'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        fullName: 'Andrés Muñoz',
        phone: '+573001112233',
        email: 'andres@isp.example',
        isActive: true
      });
    });

    it('400 — rejects an empty name', async () => {
      const res = await request(app)
        .post('/api/technicians')
        .set('Authorization', auth())
        .send({ fullName: '   ', phone: '+573001112233' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects a malformed phone', async () => {
      const res = await request(app)
        .post('/api/technicians')
        .set('Authorization', auth())
        .send({ fullName: 'Bad Phone', phone: 'abc' });

      expect(res.status).toBe(400);
    });

    it('[TKT-095] 409 — returns conflict on a duplicate phone', async () => {
      await seedTechnician(prisma, { phone: '+573009998877' });

      const res = await request(app)
        .post('/api/technicians')
        .set('Authorization', auth())
        .send({ fullName: 'Duplicate', phone: '+573009998877' });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/technicians', () => {
    it('200 — lists technicians', async () => {
      await seedTechnician(prisma, { fullName: 'Listed Tech' });

      const res = await request(app)
        .get('/api/technicians')
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.technicians)).toBe(true);
    });

    it('200 — filters to active technicians only', async () => {
      await seedTechnician(prisma, {
        phone: '+573001110001',
        isActive: false
      });
      await seedTechnician(prisma, {
        phone: '+573001110002',
        isActive: true
      });

      const res = await request(app)
        .get('/api/technicians?activeOnly=true')
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(
        res.body.data.technicians.every(
          (t: { isActive: boolean }) => t.isActive
        )
      ).toBe(true);
    });

    it('200 — returns a technician by id', async () => {
      const id = await seedTechnician(prisma);

      const res = await request(app)
        .get(`/api/technicians/${id}`)
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .get(`/api/technicians/${GHOST_ID}`)
        .set('Authorization', auth());

      expect(res.status).toBe(404);
    });

    it('400 — malformed id', async () => {
      const res = await request(app)
        .get(`/api/technicians/${INVALID_ID}`)
        .set('Authorization', auth());

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/technicians/:id', () => {
    it('200 — deactivates a technician', async () => {
      const id = await seedTechnician(prisma);

      const res = await request(app)
        .put(`/api/technicians/${id}`)
        .set('Authorization', auth())
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('200 — renames a technician and the change is readable back', async () => {
      const id = await seedTechnician(prisma);

      await request(app)
        .put(`/api/technicians/${id}`)
        .set('Authorization', auth())
        .send({ fullName: 'Renamed Tech' });

      const res = await request(app)
        .get(`/api/technicians/${id}`)
        .set('Authorization', auth());

      expect(res.body.data.fullName).toBe('Renamed Tech');
    });

    it('[TKT-095] 409 — rejects a phone owned by another technician', async () => {
      await seedTechnician(prisma, { phone: '+573001110003' });
      const id = await seedTechnician(prisma, {
        phone: '+573001110004'
      });

      const res = await request(app)
        .put(`/api/technicians/${id}`)
        .set('Authorization', auth())
        .send({ phone: '+573001110003' });

      expect(res.status).toBe(409);
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .put(`/api/technicians/${GHOST_ID}`)
        .set('Authorization', auth())
        .send({ fullName: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/technicians/:id', () => {
    it('204 — deletes a technician with no tickets', async () => {
      const id = await seedTechnician(prisma);

      const res = await request(app)
        .delete(`/api/technicians/${id}`)
        .set('Authorization', auth());

      expect(res.status).toBe(204);
    });

    it('[TKT-097] 409 — refuses to delete a technician who has tickets', async () => {
      const technicianId = await seedTechnician(prisma);
      await seedTicket(prisma, {
        technicianId,
        status: 'ASSIGNED',
        deviceId: null,
        customerId: null
      });

      const res = await request(app)
        .delete(`/api/technicians/${technicianId}`)
        .set('Authorization', auth());

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Cannot delete');
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .delete(`/api/technicians/${GHOST_ID}`)
        .set('Authorization', auth());

      expect(res.status).toBe(404);
    });
  });
});
