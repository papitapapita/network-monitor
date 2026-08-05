// Source: src/presentation/http/routes/ticket.routes.ts
// Tests the full HTTP stack for ticket CRUD, the state machine and the
// technician day sheet via supertest against a real Postgres DB.

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanTickets,
  cleanBills,
  cleanCustomers,
  cleanCatalog,
  seedTechnician,
  seedTicket,
  seedCustomer,
  seedDevice,
  seedDeviceModel,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';

const TODAY = '2026-08-04';

describe('Ticket Routes — /api/tickets', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let token: string;
  let viewerToken: string;
  let customerId: string;
  let deviceId: string;
  let technicianId: string;

  const auth = () => `Bearer ${token}`;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    // FK-safe order: tickets and bills both reference customers, and bills
    // do so with RESTRICT.
    await cleanTickets(prisma);
    await cleanBills(prisma);
    await cleanCustomers(prisma);
    await cleanCatalog(prisma);

    token = await seedAndGetToken(app, prisma, 'ADMIN');
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');

    customerId = await seedCustomer(prisma, {
      fullName: 'Marta Ríos',
      phone: '3001234567',
      email: 'marta@example.com'
    });
    const deviceModelId = await seedDeviceModel(prisma);
    deviceId = await seedDevice(prisma, deviceModelId, {
      name: 'CPE-Marta'
    });
    technicianId = await seedTechnician(prisma, {
      fullName: 'Andrés Muñoz'
    });
  });

  const validBody = () => ({
    title: 'No internet since this morning',
    description: 'Customer reports the link has been down since 7am.',
    category: 'CONNECTIVITY',
    priority: 'HIGH',
    customerId,
    deviceId,
    address: {
      street: 'Calle 5 #12-34',
      municipality: 'Popayán',
      neighborhood: 'Centro'
    }
  });

  describe('authentication and authorization', () => {
    it('401 — rejects a request with no token', async () => {
      const res = await request(app).get('/api/tickets');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('403 — rejects a VIEWER creating a ticket', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(validBody());

      expect(res.status).toBe(403);
    });

    it('403 — rejects a VIEWER resolving a ticket', async () => {
      const id = await seedTicket(prisma, {
        customerId,
        technicianId,
        status: 'IN_PROGRESS'
      });

      const res = await request(app)
        .post(`/api/tickets/${id}/resolve`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ resolutionNotes: 'done' });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/tickets', () => {
    it('[TKT-006] 201 — creates a ticket in OPEN status with a code', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', auth())
        .send(validBody());

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        status: 'OPEN',
        priority: 'HIGH',
        category: 'CONNECTIVITY',
        origin: 'MANUAL',
        customerId,
        deviceId,
        technicianId: null
      });
      expect(typeof res.body.data.code).toBe('number');
      expect(res.body.data.address.street).toBe('Calle 5 #12-34');
    });

    it('201 — records the authenticated user as the author', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', auth())
        .send(validBody());

      expect(res.body.data.createdBy).not.toBeNull();
    });

    it('201 — assigns at creation when a technician is supplied', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', auth())
        .send({
          ...validBody(),
          technicianId,
          scheduledFor: TODAY
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('ASSIGNED');
      expect(res.body.data.technicianId).toBe(technicianId);
      expect(res.body.data.scheduledFor).toBe(TODAY);
    });

    it('400 — rejects a ticket with neither a customer nor a device', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', auth())
        .send({
          title: 'Orphan',
          description: 'No links at all',
          category: 'OTHER'
        });

      expect(res.status).toBe(400);
    });

    it('400 — rejects an empty title', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', auth())
        .send({ ...validBody(), title: '   ' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects an unknown category', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', auth())
        .send({ ...validBody(), category: 'SPACESHIP' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects a partial address', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', auth())
        .send({
          ...validBody(),
          address: {
            street: 'Calle 5',
            municipality: '',
            neighborhood: ''
          }
        });

      expect(res.status).toBe(400);
    });

    it('400 — rejects a malformed scheduledFor', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', auth())
        .send({ ...validBody(), scheduledFor: '04-08-2026' });

      expect(res.status).toBe(400);
    });

    it('404 — rejects an unknown customer', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', auth())
        .send({ ...validBody(), customerId: GHOST_ID });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/tickets', () => {
    it('200 — lists tickets with the pagination envelope', async () => {
      await seedTicket(prisma, { customerId, deviceId });

      const res = await request(app)
        .get('/api/tickets')
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.tickets)).toBe(true);
      expect(res.body.data).toHaveProperty('hasMore');
    });

    it('200 — filters by status', async () => {
      await seedTicket(prisma, { customerId, status: 'OPEN' });
      await seedTicket(prisma, {
        customerId,
        technicianId,
        status: 'ASSIGNED'
      });

      const res = await request(app)
        .get('/api/tickets?status=ASSIGNED')
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.tickets[0].status).toBe('ASSIGNED');
    });

    it('200 — filters to unassigned tickets', async () => {
      await seedTicket(prisma, { customerId, status: 'OPEN' });
      await seedTicket(prisma, {
        customerId,
        technicianId,
        status: 'ASSIGNED'
      });

      const res = await request(app)
        .get('/api/tickets?unassignedOnly=true')
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.tickets[0].technicianId).toBeNull();
    });

    it('400 — rejects a malformed date filter', async () => {
      const res = await request(app)
        .get('/api/tickets?scheduledFrom=nope')
        .set('Authorization', auth());

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/tickets/:id', () => {
    it('200 — returns the ticket with customer contact and device details', async () => {
      const id = await seedTicket(prisma, { customerId, deviceId });

      const res = await request(app)
        .get(`/api/tickets/${id}`)
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.data.customer).toMatchObject({
        fullName: 'Marta Ríos',
        phone: '3001234567'
      });
      expect(res.body.data.device).toMatchObject({
        name: 'CPE-Marta'
      });
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .get(`/api/tickets/${GHOST_ID}`)
        .set('Authorization', auth());

      expect(res.status).toBe(404);
    });

    it('400 — malformed id', async () => {
      const res = await request(app)
        .get(`/api/tickets/${INVALID_ID}`)
        .set('Authorization', auth());

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/tickets/my-day', () => {
    it('200 — returns the day sheet with contact, device and address', async () => {
      const ticketId = await seedTicket(prisma, {
        customerId,
        deviceId,
        technicianId,
        status: 'ASSIGNED',
        scheduledFor: new Date(`${TODAY}T00:00:00.000Z`)
      });

      const res = await request(app)
        .get(
          `/api/tickets/my-day?technicianId=${technicianId}&date=${TODAY}`
        )
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.data.date).toBe(TODAY);
      expect(res.body.data.technician.fullName).toBe('Andrés Muñoz');
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.tickets[0].id).toBe(ticketId);
      expect(res.body.data.tickets[0].customer.phone).toBe(
        '3001234567'
      );
      expect(res.body.data.tickets[0].device.name).toBe('CPE-Marta');
    });

    it('200 — orders the day most urgent first', async () => {
      const scheduledFor = new Date(`${TODAY}T00:00:00.000Z`);
      await seedTicket(prisma, {
        customerId,
        technicianId,
        status: 'ASSIGNED',
        priority: 'LOW',
        title: 'Low job',
        scheduledFor
      });
      await seedTicket(prisma, {
        customerId,
        technicianId,
        status: 'ASSIGNED',
        priority: 'URGENT',
        title: 'Urgent job',
        scheduledFor
      });
      await seedTicket(prisma, {
        customerId,
        technicianId,
        status: 'ASSIGNED',
        priority: 'NORMAL',
        title: 'Normal job',
        scheduledFor
      });

      const res = await request(app)
        .get(
          `/api/tickets/my-day?technicianId=${technicianId}&date=${TODAY}`
        )
        .set('Authorization', auth());

      expect(
        res.body.data.tickets.map((t: { title: string }) => t.title)
      ).toEqual(['Urgent job', 'Normal job', 'Low job']);
    });

    it('200 — excludes tickets scheduled for another day', async () => {
      await seedTicket(prisma, {
        customerId,
        technicianId,
        status: 'ASSIGNED',
        scheduledFor: new Date('2026-08-05T00:00:00.000Z')
      });

      const res = await request(app)
        .get(
          `/api/tickets/my-day?technicianId=${technicianId}&date=${TODAY}`
        )
        .set('Authorization', auth());

      expect(res.body.data.total).toBe(0);
    });

    it('200 — excludes resolved tickets', async () => {
      await seedTicket(prisma, {
        customerId,
        technicianId,
        status: 'RESOLVED',
        scheduledFor: new Date(`${TODAY}T00:00:00.000Z`)
      });

      const res = await request(app)
        .get(
          `/api/tickets/my-day?technicianId=${technicianId}&date=${TODAY}`
        )
        .set('Authorization', auth());

      expect(res.body.data.total).toBe(0);
    });

    it('404 — unknown technician', async () => {
      const res = await request(app)
        .get(`/api/tickets/my-day?technicianId=${GHOST_ID}`)
        .set('Authorization', auth());

      expect(res.status).toBe(404);
    });

    it('400 — missing technicianId', async () => {
      const res = await request(app)
        .get('/api/tickets/my-day')
        .set('Authorization', auth());

      expect(res.status).toBe(400);
    });
  });

  describe('ticket lifecycle', () => {
    it('200 — assign moves the ticket to ASSIGNED', async () => {
      const id = await seedTicket(prisma, { customerId, deviceId });

      const res = await request(app)
        .post(`/api/tickets/${id}/assign`)
        .set('Authorization', auth())
        .send({ technicianId, scheduledFor: TODAY });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ASSIGNED');
      expect(res.body.data.assignedAt).not.toBeNull();
    });

    it('[TKT-077] 409 — refuses to assign an inactive technician', async () => {
      const inactiveId = await seedTechnician(prisma, {
        phone: '+573005550000',
        isActive: false
      });
      const id = await seedTicket(prisma, { customerId });

      const res = await request(app)
        .post(`/api/tickets/${id}/assign`)
        .set('Authorization', auth())
        .send({ technicianId: inactiveId });

      expect(res.status).toBe(409);
    });

    it('200 — start moves an assigned ticket to IN_PROGRESS', async () => {
      const id = await seedTicket(prisma, {
        customerId,
        technicianId,
        status: 'ASSIGNED'
      });

      const res = await request(app)
        .post(`/api/tickets/${id}/start`)
        .set('Authorization', auth())
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('IN_PROGRESS');
      expect(res.body.data.startedAt).not.toBeNull();
    });

    it('409 — refuses to start an unassigned ticket', async () => {
      const id = await seedTicket(prisma, { customerId });

      const res = await request(app)
        .post(`/api/tickets/${id}/start`)
        .set('Authorization', auth())
        .send({});

      expect(res.status).toBe(409);
    });

    it('200 — resolve records the notes and closes the ticket', async () => {
      const id = await seedTicket(prisma, {
        customerId,
        technicianId,
        status: 'IN_PROGRESS'
      });

      const res = await request(app)
        .post(`/api/tickets/${id}/resolve`)
        .set('Authorization', auth())
        .send({ resolutionNotes: 'Realigned the antenna' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('RESOLVED');
      expect(res.body.data.resolutionNotes).toBe(
        'Realigned the antenna'
      );
    });

    it('400 — resolve requires notes', async () => {
      const id = await seedTicket(prisma, {
        customerId,
        technicianId,
        status: 'IN_PROGRESS'
      });

      const res = await request(app)
        .post(`/api/tickets/${id}/resolve`)
        .set('Authorization', auth())
        .send({ resolutionNotes: '  ' });

      expect(res.status).toBe(400);
    });

    it('409 — refuses to modify a resolved ticket', async () => {
      const id = await seedTicket(prisma, {
        customerId,
        technicianId,
        status: 'RESOLVED'
      });

      const res = await request(app)
        .post(`/api/tickets/${id}/cancel`)
        .set('Authorization', auth())
        .send({ reason: 'Too late' });

      expect(res.status).toBe(409);
    });

    it('200 — cancel records the reason', async () => {
      const id = await seedTicket(prisma, { customerId });

      const res = await request(app)
        .post(`/api/tickets/${id}/cancel`)
        .set('Authorization', auth())
        .send({ reason: 'Duplicate report' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
      expect(res.body.data.cancelReason).toBe('Duplicate report');
    });

    it('200 — schedule moves the visit to another day', async () => {
      const id = await seedTicket(prisma, { customerId });

      const res = await request(app)
        .post(`/api/tickets/${id}/schedule`)
        .set('Authorization', auth())
        .send({ scheduledFor: '2026-09-01' });

      expect(res.status).toBe(200);
      expect(res.body.data.scheduledFor).toBe('2026-09-01');
    });

    it('404 — assigning an unknown ticket', async () => {
      const res = await request(app)
        .post(`/api/tickets/${GHOST_ID}/assign`)
        .set('Authorization', auth())
        .send({ technicianId });

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/tickets/:id', () => {
    it('200 — updates the title and priority', async () => {
      const id = await seedTicket(prisma, { customerId });

      const res = await request(app)
        .put(`/api/tickets/${id}`)
        .set('Authorization', auth())
        .send({ title: 'Updated title', priority: 'URGENT' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated title');
      expect(res.body.data.priority).toBe('URGENT');
    });

    it('400 — rejects an empty body', async () => {
      const id = await seedTicket(prisma, { customerId });

      const res = await request(app)
        .put(`/api/tickets/${id}`)
        .set('Authorization', auth())
        .send({});

      expect(res.status).toBe(400);
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .put(`/api/tickets/${GHOST_ID}`)
        .set('Authorization', auth())
        .send({ title: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/tickets/:id', () => {
    it('204 — deletes a ticket', async () => {
      const id = await seedTicket(prisma, { customerId });

      const res = await request(app)
        .delete(`/api/tickets/${id}`)
        .set('Authorization', auth());

      expect(res.status).toBe(204);

      const readBack = await request(app)
        .get(`/api/tickets/${id}`)
        .set('Authorization', auth());
      expect(readBack.status).toBe(404);
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .delete(`/api/tickets/${GHOST_ID}`)
        .set('Authorization', auth());

      expect(res.status).toBe(404);
    });
  });
});
