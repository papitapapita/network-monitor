import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanDatabase,
  seedDeviceModel,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Device Routes — /api/devices', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let deviceModelId: string;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/devices
  // ─────────────────────────────────────────────────────────────

  describe('POST /api/devices', () => {
    it('201 — creates a device with required fields only', async () => {
      const res = await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Core Router SP01',
        ownerType: 'COMPANY',
        serialNumber: 'SN-001'
      });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        name: 'Core Router SP01',
        ownerType: 'COMPANY',
        status: 'INVENTORY'
      });
      expect(res.body.data.id).toBeDefined();
    });

    it('201 — creates a device with all optional fields', async () => {
      const res = await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Access Point Floor 3',
        ownerType: 'CLIENT',
        status: 'ACTIVE',
        category: 'ACCESS_POINT',
        serialNumber: 'SN-00123',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        ipAddress: '192.168.1.100',
        description: 'Client CPE on floor 3',
        installedDate: '2025-01-15T00:00:00.000Z',
        monitoringEnabled: true
      });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        name: 'Access Point Floor 3',
        status: 'ACTIVE',
        category: 'ACCESS_POINT',
        serialNumber: 'SN-00123',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        ipAddress: '192.168.1.100',
        monitoringEnabled: true
      });
    });

    it('[DEV-040] 400 — rejects missing deviceModelId', async () => {
      const res = await request(app).post('/api/devices').send({
        name: 'Router',
        ownerType: 'COMPANY'
      });

      expect(res.status).toBe(400);
    });

    it('[DEV-040] 400 — rejects missing name', async () => {
      const res = await request(app).post('/api/devices').send({
        deviceModelId,
        ownerType: 'COMPANY'
      });

      expect(res.status).toBe(400);
    });

    it('[DEV-044] 400 — rejects missing ownerType', async () => {
      const res = await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Router'
      });

      expect(res.status).toBe(400);
    });

    it('[DEV-044] 400 — rejects invalid ownerType', async () => {
      const res = await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Router',
        ownerType: 'PERSONAL'
      });

      expect(res.status).toBe(400);
    });

    it('[DEV-046] 400 — rejects malformed MAC address', async () => {
      const res = await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Router',
        ownerType: 'COMPANY',
        macAddress: 'GG:HH:II:JJ:KK:LL'
      });

      expect(res.status).toBe(400);
    });

    it('400 — rejects unknown deviceModelId', async () => {
      const res = await request(app).post('/api/devices').send({
        deviceModelId: GHOST_ID,
        name: 'Router',
        ownerType: 'COMPANY'
      });

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/devices
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/devices', () => {
    it('200 — returns empty list when no devices exist', async () => {
      const res = await request(app).get('/api/devices');

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
    });

    it('200 — returns created devices', async () => {
      await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Router A',
        ownerType: 'COMPANY',
        serialNumber: 'SN-A-001'
      });
      await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Router B',
        ownerType: 'COMPANY',
        serialNumber: 'SN-B-001'
      });

      const res = await request(app).get('/api/devices');

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
    });

    it('200 — filters by status', async () => {
      await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Active Router',
        ownerType: 'COMPANY',
        status: 'ACTIVE',
        ipAddress: '10.0.0.1'
      });
      await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Inventory Router',
        ownerType: 'COMPANY',
        status: 'INVENTORY',
        serialNumber: 'SN-INV-001'
      });

      const res = await request(app).get('/api/devices?status=ACTIVE');

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.devices[0].status).toBe('ACTIVE');
    });

    it('200 — filters by owner', async () => {
      await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Company Device',
        ownerType: 'COMPANY',
        serialNumber: 'SN-CO-001'
      });
      await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Client Device',
        ownerType: 'CLIENT',
        serialNumber: 'SN-CL-001'
      });

      const res = await request(app).get('/api/devices?owner=CLIENT');

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.devices[0].ownerType).toBe('CLIENT');
    });

    it('200 — paginates with limit and offset', async () => {
      for (let i = 1; i <= 4; i++) {
        await request(app).post('/api/devices').send({
          deviceModelId,
          name: `Device ${i}`,
          ownerType: 'COMPANY',
          serialNumber: `SN-${i.toString().padStart(3, '0')}`
        });
      }

      const page1 = await request(app).get('/api/devices?limit=2&offset=0');
      const page2 = await request(app).get('/api/devices?limit=2&offset=2');

      expect(page1.status).toBe(200);
      expect(page1.body.data.devices).toHaveLength(2);
      expect(page1.body.data.hasMore).toBe(true);

      expect(page2.status).toBe(200);
      expect(page2.body.data.devices).toHaveLength(2);
      expect(page2.body.data.hasMore).toBe(false);
    });

    it('200 — searches by name fragment', async () => {
      await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Core Router',
        ownerType: 'COMPANY',
        serialNumber: 'SN-CR-001'
      });
      await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Access Point',
        ownerType: 'COMPANY',
        serialNumber: 'SN-AP-001'
      });

      const res = await request(app).get('/api/devices?search=Core');

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.devices[0].name).toBe('Core Router');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/devices/:id
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/devices/:id', () => {
    it('200 — returns an existing device', async () => {
      const create = await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Switch Floor 1',
        ownerType: 'COMPANY',
        serialNumber: 'SN-SW-001'
      });
      const id = create.body.data.id as string;

      const res = await request(app).get(`/api/devices/${id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);
      expect(res.body.data.name).toBe('Switch Floor 1');
    });

    it('404 — returns not found for unknown UUID', async () => {
      const res = await request(app).get(`/api/devices/${GHOST_ID}`);

      expect(res.status).toBe(404);
    });

    it('400 — returns bad request for invalid UUID', async () => {
      const res = await request(app).get(`/api/devices/${INVALID_ID}`);

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /api/devices/:id
  // ─────────────────────────────────────────────────────────────

  describe('PATCH /api/devices/:id', () => {
    it('200 — updates name and status', async () => {
      const create = await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Old Name',
        ownerType: 'COMPANY',
        serialNumber: 'SN-OLD-001'
      });
      const id = create.body.data.id as string;

      const res = await request(app)
        .patch(`/api/devices/${id}`)
        .send({ name: 'New Name', status: 'DAMAGED' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('New Name');
      expect(res.body.data.status).toBe('DAMAGED');
    });

    it('200 — sets IP address', async () => {
      const create = await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Router',
        ownerType: 'COMPANY',
        serialNumber: 'SN-RT-001'
      });
      const id = create.body.data.id as string;

      const res = await request(app)
        .patch(`/api/devices/${id}`)
        .send({ ipAddress: '10.0.0.1' });

      expect(res.status).toBe(200);
      expect(res.body.data.ipAddress).toBe('10.0.0.1');
    });

    it('200 — clears optional fields with null', async () => {
      const create = await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Router',
        ownerType: 'COMPANY',
        serialNumber: 'SN-001'
      });
      const id = create.body.data.id as string;

      const res = await request(app)
        .patch(`/api/devices/${id}`)
        .send({ serialNumber: null });

      expect(res.status).toBe(200);
      expect(res.body.data.serialNumber).toBeNull();
    });

    it('404 — returns not found for unknown UUID', async () => {
      const res = await request(app)
        .patch(`/api/devices/${GHOST_ID}`)
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });

    it('[DEV-042] 400 — rejects invalid status value', async () => {
      const create = await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Router',
        ownerType: 'COMPANY',
        serialNumber: 'SN-RT-002'
      });
      const id = create.body.data.id as string;

      const res = await request(app)
        .patch(`/api/devices/${id}`)
        .send({ status: 'BROKEN' });

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /api/devices/:id
  // ─────────────────────────────────────────────────────────────

  describe('DELETE /api/devices/:id', () => {
    it('204 — deletes an existing device and returns no body', async () => {
      const create = await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Switch To Delete',
        ownerType: 'COMPANY',
        serialNumber: 'SN-DEL-001'
      });
      const id = create.body.data.id as string;

      const res = await request(app).delete(`/api/devices/${id}`);

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
    });

    it('404 — confirms the device is gone after deletion', async () => {
      const create = await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Transient Router',
        ownerType: 'COMPANY',
        serialNumber: 'SN-TR-001'
      });
      const id = create.body.data.id as string;

      await request(app).delete(`/api/devices/${id}`);

      const res = await request(app).get(`/api/devices/${id}`);
      expect(res.status).toBe(404);
    });

    it('[DEV-068] 404 — returns not found for an unknown UUID', async () => {
      const res = await request(app).delete(`/api/devices/${GHOST_ID}`);

      expect(res.status).toBe(404);
    });

    it('400 — returns bad request for an invalid UUID', async () => {
      const res = await request(app).delete(`/api/devices/${INVALID_ID}`);

      expect(res.status).toBe(400);
    });

    it('404 — second DELETE on the same id returns not found', async () => {
      // After deletion the device no longer exists; a repeat DELETE must not
      // silently succeed — the use case treats "not found" as a failure mapped to 404.
      const create = await request(app).post('/api/devices').send({
        deviceModelId,
        name: 'Idempotency Test Device',
        ownerType: 'COMPANY',
        serialNumber: 'SN-IDE-001'
      });
      const id = create.body.data.id as string;

      await request(app).delete(`/api/devices/${id}`);
      const secondDelete = await request(app).delete(`/api/devices/${id}`);

      expect(secondDelete.status).toBe(404);
    });
  });
});
