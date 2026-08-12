import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanDatabase,
  cleanBills,
  cleanCustomers,
  cleanTickets,
  seedDeviceModel,
  seedWirelessDeviceModel,
  seedLocation,
  seedCustomer,
  seedServicePlan,
  seedActiveContractedService,
  seedTicket,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Device Routes — /api/devices', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let deviceModelId: string;
  let adminToken: string;
  let locationId: string;

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
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
    locationId = await seedLocation(prisma);
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/devices
  // ─────────────────────────────────────────────────────────────

  describe('POST /api/devices', () => {
    it('201 — creates a device with required fields only', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
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
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Access Point Floor 3',
          ownerType: 'CLIENT',
          status: 'ACTIVE',
          category: 'ACCESS_POINT',
          serialNumber: 'SN-00123',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          ipAddress: '192.168.1.100',
          locationId,
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
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Router',
          ownerType: 'COMPANY'
        });

      expect(res.status).toBe(400);
    });

    it('[DEV-040] 400 — rejects missing name', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          ownerType: 'COMPANY'
        });

      expect(res.status).toBe(400);
    });

    it('[DEV-044] 400 — rejects missing ownerType', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Router'
        });

      expect(res.status).toBe(400);
    });

    it('[DEV-044] 400 — rejects invalid ownerType', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Router',
          ownerType: 'PERSONAL'
        });

      expect(res.status).toBe(400);
    });

    it('[DEV-046] 400 — rejects malformed MAC address', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Router',
          ownerType: 'COMPANY',
          macAddress: 'GG:HH:II:JJ:KK:LL'
        });

      expect(res.status).toBe(400);
    });

    it('[DEV-066] 404 — rejects unknown deviceModelId', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId: GHOST_ID,
          name: 'Router',
          ownerType: 'COMPANY'
        });

      expect(res.status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/devices
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/devices', () => {
    it('200 — returns empty list when no devices exist', async () => {
      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
    });

    it('200 — returns created devices', async () => {
      await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Router A',
          ownerType: 'COMPANY',
          serialNumber: 'SN-A-001'
        });
      await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Router B',
          ownerType: 'COMPANY',
          serialNumber: 'SN-B-001'
        });

      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
    });

    it('200 — filters by status', async () => {
      await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Active Router',
          ownerType: 'COMPANY',
          status: 'ACTIVE',
          ipAddress: '10.0.0.1',
          locationId
        });
      await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Inventory Router',
          ownerType: 'COMPANY',
          status: 'INVENTORY',
          serialNumber: 'SN-INV-001'
        });

      const res = await request(app)
        .get('/api/devices?status=ACTIVE')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.devices[0].status).toBe('ACTIVE');
    });

    it('200 — filters by owner', async () => {
      await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Company Device',
          ownerType: 'COMPANY',
          serialNumber: 'SN-CO-001'
        });
      await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Client Device',
          ownerType: 'CLIENT',
          serialNumber: 'SN-CL-001'
        });

      const res = await request(app)
        .get('/api/devices?owner=CLIENT')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.devices[0].ownerType).toBe('CLIENT');
    });

    it('200 — paginates with limit and offset', async () => {
      for (let i = 1; i <= 4; i++) {
        await request(app)
          .post('/api/devices')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            deviceModelId,
            name: `Device ${i}`,
            ownerType: 'COMPANY',
            serialNumber: `SN-${i.toString().padStart(3, '0')}`
          });
      }

      const page1 = await request(app)
        .get('/api/devices?limit=2&offset=0')
        .set('Authorization', `Bearer ${adminToken}`);
      const page2 = await request(app)
        .get('/api/devices?limit=2&offset=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(page1.status).toBe(200);
      expect(page1.body.data.devices).toHaveLength(2);
      expect(page1.body.data.hasMore).toBe(true);

      expect(page2.status).toBe(200);
      expect(page2.body.data.devices).toHaveLength(2);
      expect(page2.body.data.hasMore).toBe(false);
    });

    it('200 — searches by name fragment', async () => {
      await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Core Router',
          ownerType: 'COMPANY',
          serialNumber: 'SN-CR-001'
        });
      await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Access Point',
          ownerType: 'COMPANY',
          serialNumber: 'SN-AP-001'
        });

      const res = await request(app)
        .get('/api/devices?search=Core')
        .set('Authorization', `Bearer ${adminToken}`);

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
      const create = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Switch Floor 1',
          ownerType: 'COMPANY',
          serialNumber: 'SN-SW-001'
        });
      const id = create.body.data.id as string;

      const res = await request(app)
        .get(`/api/devices/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);
      expect(res.body.data.name).toBe('Switch Floor 1');
    });

    it('404 — returns not found for unknown UUID', async () => {
      const res = await request(app)
        .get(`/api/devices/${GHOST_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('400 — returns bad request for invalid UUID', async () => {
      const res = await request(app)
        .get(`/api/devices/${INVALID_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /api/devices/:id
  // ─────────────────────────────────────────────────────────────

  describe('PATCH /api/devices/:id', () => {
    it('200 — updates name and status', async () => {
      const create = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Old Name',
          ownerType: 'COMPANY',
          serialNumber: 'SN-OLD-001'
        });
      const id = create.body.data.id as string;

      const res = await request(app)
        .patch(`/api/devices/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Name', status: 'DAMAGED' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('New Name');
      expect(res.body.data.status).toBe('DAMAGED');
    });

    it('200 — sets IP address', async () => {
      const create = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Router',
          ownerType: 'COMPANY',
          serialNumber: 'SN-RT-001'
        });
      const id = create.body.data.id as string;

      const res = await request(app)
        .patch(`/api/devices/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ipAddress: '10.0.0.1' });

      expect(res.status).toBe(200);
      expect(res.body.data.ipAddress).toBe('10.0.0.1');
    });

    it('200 — clears optional fields with null', async () => {
      const create = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Router',
          ownerType: 'COMPANY',
          serialNumber: 'SN-001',
          macAddress: 'AA:BB:CC:DD:EE:01'
        });
      const id = create.body.data.id as string;

      const res = await request(app)
        .patch(`/api/devices/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ serialNumber: null });

      expect(res.status).toBe(200);
      expect(res.body.data.serialNumber).toBeNull();
    });

    it('[DEV-069] 404 — returns not found for unknown UUID', async () => {
      const res = await request(app)
        .patch(`/api/devices/${GHOST_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });

    it('[DEV-042] 400 — rejects invalid status value', async () => {
      const create = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Router',
          ownerType: 'COMPANY',
          serialNumber: 'SN-RT-002'
        });
      const id = create.body.data.id as string;

      const res = await request(app)
        .patch(`/api/devices/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'BROKEN' });

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /api/devices/:id
  // ─────────────────────────────────────────────────────────────

  describe('DELETE /api/devices/:id', () => {
    it('204 — deletes an existing device and returns no body', async () => {
      const create = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Switch To Delete',
          ownerType: 'COMPANY',
          serialNumber: 'SN-DEL-001'
        });
      const id = create.body.data.id as string;

      const res = await request(app)
        .delete(`/api/devices/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
    });

    it('404 — confirms the device is gone after deletion', async () => {
      const create = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Transient Router',
          ownerType: 'COMPANY',
          serialNumber: 'SN-TR-001'
        });
      const id = create.body.data.id as string;

      await request(app)
        .delete(`/api/devices/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get(`/api/devices/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('[DEV-068] 404 — returns not found for an unknown UUID', async () => {
      const res = await request(app)
        .delete(`/api/devices/${GHOST_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('400 — returns bad request for an invalid UUID', async () => {
      const res = await request(app)
        .delete(`/api/devices/${INVALID_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('404 — second DELETE on the same id returns not found', async () => {
      // After deletion the device no longer exists; a repeat DELETE must not
      // silently succeed — the use case treats "not found" as a failure mapped to 404.
      const create = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId,
          name: 'Idempotency Test Device',
          ownerType: 'COMPANY',
          serialNumber: 'SN-IDE-001'
        });
      const id = create.body.data.id as string;

      await request(app)
        .delete(`/api/devices/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const secondDelete = await request(app)
        .delete(`/api/devices/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(secondDelete.status).toBe(404);
    });
  });
  // ─────────────────────────────────────────────────────────────
  // Lifecycle endpoints — POST /:id/restore and POST /:id/replace
  // ─────────────────────────────────────────────────────────────

  describe('lifecycle endpoints', () => {
    let adminToken: string;
    let operatorToken: string;
    let viewerToken: string;
    let wirelessModelId: string;
    let locationId: string;

    beforeEach(async () => {
      await cleanBills(prisma);
      await cleanTickets(prisma);
      await cleanCustomers(prisma);
      await cleanDatabase(prisma);
      wirelessModelId = await seedWirelessDeviceModel(prisma);
      locationId = await seedLocation(prisma);
      adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
      operatorToken = await seedAndGetToken(app, prisma, 'OPERATOR');
      viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
    });

    async function createActive(
      overrides: Record<string, unknown> = {}
    ): Promise<string> {
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceModelId: wirelessModelId,
          name: 'CPE-Route-Test',
          ownerType: 'CLIENT',
          category: 'WIRELESS_CPE',
          serialNumber: 'SN-RT-001',
          locationId,
          status: 'ACTIVE',
          ipAddress: '10.90.0.10',
          ...overrides
        });
      expect(res.status).toBe(201);
      return res.body.data.id as string;
    }

    // ───────────────────────────────────────────────────────────
    describe('DELETE /api/devices/:id — soft delete', () => {
      it('204 — deletes and the device drops out of the listing', async () => {
        const id = await createActive();

        const res = await request(app)
          .delete(`/api/devices/${id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(204);

        const list = await request(app)
          .get('/api/devices')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(
          list.body.data.devices.map((d: { id: string }) => d.id)
        ).not.toContain(id);
      });

      it('[DEV-075] 400 — refuses while a live contracted service points at it', async () => {
        const id = await createActive();
        const customerId = await seedCustomer(prisma);
        const servicePlanId = await seedServicePlan(prisma);
        await seedActiveContractedService(
          prisma,
          customerId,
          servicePlanId,
          { deviceId: id }
        );

        const res = await request(app)
          .delete(`/api/devices/${id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/live contracted service/i);
      });

      it('[DEV-076] 400 — refuses while an open ticket references it', async () => {
        const id = await createActive();
        await seedTicket(prisma, { deviceId: id, status: 'OPEN' });

        const res = await request(app)
          .delete(`/api/devices/${id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/open ticket/i);
      });
    });

    // ───────────────────────────────────────────────────────────
    describe('POST /api/devices/:id/restore', () => {
      it('200 — restores a deleted device and returns the envelope', async () => {
        const id = await createActive();
        await request(app)
          .delete(`/api/devices/${id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        const res = await request(app)
          .post(`/api/devices/${id}/restore`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe(id);
        expect(res.body.data.deletedAt).toBeNull();

        const reread = await request(app)
          .get(`/api/devices/${id}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(reread.status).toBe(200);
      });

      it('401 — rejects an unauthenticated request', async () => {
        const res = await request(app).post(
          `/api/devices/${GHOST_ID}/restore`
        );

        expect(res.status).toBe(401);
      });

      // restore is the inverse of delete, so it takes the same permission.
      it('403 — rejects an OPERATOR', async () => {
        const res = await request(app)
          .post(`/api/devices/${GHOST_ID}/restore`)
          .set('Authorization', `Bearer ${operatorToken}`);

        expect(res.status).toBe(403);
      });

      it('400 — rejects a malformed id', async () => {
        const res = await request(app)
          .post(`/api/devices/${INVALID_ID}/restore`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
      });

      it('404 — unknown id', async () => {
        const res = await request(app)
          .post(`/api/devices/${GHOST_ID}/restore`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(404);
      });

      it('400 — refuses a device that is not deleted', async () => {
        const id = await createActive();

        const res = await request(app)
          .post(`/api/devices/${id}/restore`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/not deleted/i);
      });
    });

    // ───────────────────────────────────────────────────────────
    describe('POST /api/devices/:id/replace', () => {
      const body = {
        retiredStatus: 'DAMAGED',
        serialNumber: 'SN-RT-NEW'
      };

      it('201 — retires the old unit and returns both devices', async () => {
        const id = await createActive();

        const res = await request(app)
          .post(`/api/devices/${id}/replace`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ ...body, deviceModelId: wirelessModelId });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.retiredDevice.id).toBe(id);
        expect(res.body.data.retiredDevice.status).toBe('DAMAGED');
        expect(res.body.data.newDevice.replacesDeviceId).toBe(id);
        expect(res.body.data.newDevice.ipAddress).toBe('10.90.0.10');
      });

      // 'activate' is granted to ADMIN and OPERATOR — a field swap is
      // ordinary operator work.
      it('201 — an OPERATOR may replace hardware', async () => {
        const id = await createActive();

        const res = await request(app)
          .post(`/api/devices/${id}/replace`)
          .set('Authorization', `Bearer ${operatorToken}`)
          .send({ ...body, deviceModelId: wirelessModelId });

        expect(res.status).toBe(201);
      });

      it('401 — rejects an unauthenticated request', async () => {
        const res = await request(app)
          .post(`/api/devices/${GHOST_ID}/replace`)
          .send({ ...body, deviceModelId: wirelessModelId });

        expect(res.status).toBe(401);
      });

      it('403 — rejects a VIEWER', async () => {
        const res = await request(app)
          .post(`/api/devices/${GHOST_ID}/replace`)
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({ ...body, deviceModelId: wirelessModelId });

        expect(res.status).toBe(403);
      });

      it('400 — rejects a retiredStatus that is still in service', async () => {
        const id = await createActive();

        const res = await request(app)
          .post(`/api/devices/${id}/replace`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            deviceModelId: wirelessModelId,
            retiredStatus: 'ACTIVE',
            serialNumber: 'SN-RT-NEW'
          });

        // The zod middleware answers with a generic envelope; the specific
        // rule is in `details`.
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation failed');
        expect(JSON.stringify(res.body.details)).toMatch(
          /retiredStatus must be one of/i
        );
      });

      it('400 — rejects a replacement with no identifier', async () => {
        const id = await createActive();

        const res = await request(app)
          .post(`/api/devices/${id}/replace`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            deviceModelId: wirelessModelId,
            retiredStatus: 'DAMAGED'
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation failed');
        expect(JSON.stringify(res.body.details)).toMatch(
          /serial number or MAC address/i
        );
      });

      it('404 — unknown device id', async () => {
        const res = await request(app)
          .post(`/api/devices/${GHOST_ID}/replace`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ ...body, deviceModelId: wirelessModelId });

        expect(res.status).toBe(404);
      });

      it('404 — unknown replacement model id', async () => {
        const id = await createActive();

        const res = await request(app)
          .post(`/api/devices/${id}/replace`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ ...body, deviceModelId: GHOST_ID });

        expect(res.status).toBe(404);
      });
    });
    // ───────────────────────────────────────────────────────────
    describe('GET /api/devices?deleted=... — the recycle bin', () => {
      it('200 — omits deleted devices by default', async () => {
        const id = await createActive();
        await request(app)
          .delete(`/api/devices/${id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        const res = await request(app)
          .get('/api/devices')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.total).toBe(0);
      });

      it('200 — deleted=true returns the bin with deletedAt populated', async () => {
        const id = await createActive();
        await request(app)
          .delete(`/api/devices/${id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        const res = await request(app)
          .get(
            '/api/devices?deleted=true&sortBy=deletedAt&sortOrder=DESC'
          )
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.total).toBe(1);
        expect(res.body.data.devices[0].id).toBe(id);
        expect(res.body.data.devices[0].deletedAt).not.toBeNull();
        // The authenticated deleter is recorded, which is what lets the bin
        // show "deleted by".
        expect(res.body.data.devices[0].deletedBy).not.toBeNull();
      });

      it('200 — deleted=any returns live and deleted together', async () => {
        const doomed = await createActive();
        await request(app)
          .post('/api/devices')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            deviceModelId: wirelessModelId,
            name: 'CPE-Survivor',
            ownerType: 'CLIENT',
            serialNumber: 'SN-RT-SURV'
          });
        await request(app)
          .delete(`/api/devices/${doomed}`)
          .set('Authorization', `Bearer ${adminToken}`);

        const res = await request(app)
          .get('/api/devices?deleted=any')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.total).toBe(2);
      });

      it('400 — rejects an unrecognised deleted value', async () => {
        const res = await request(app)
          .get('/api/devices?deleted=maybe')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body.details)).toMatch(
          /deleted must be true, false or any/i
        );
      });

      it('401 — rejects an unauthenticated request', async () => {
        const res = await request(app).get(
          '/api/devices?deleted=true'
        );

        expect(res.status).toBe(401);
      });
    });

    // ───────────────────────────────────────────────────────────
    describe('DELETE /api/devices/:id/purge — empty the bin', () => {
      it('204 — permanently removes a device already in the bin', async () => {
        const id = await createActive();
        await request(app)
          .delete(`/api/devices/${id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        const res = await request(app)
          .delete(`/api/devices/${id}/purge`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(204);

        const bin = await request(app)
          .get('/api/devices?deleted=true')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(bin.body.data.total).toBe(0);
      });

      it('[DEV-085] 400 — refuses a device that is not in the bin', async () => {
        const id = await createActive();

        const res = await request(app)
          .delete(`/api/devices/${id}/purge`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/not in the recycle bin/i);
      });

      it('401 — rejects an unauthenticated request', async () => {
        const res = await request(app).delete(
          `/api/devices/${GHOST_ID}/purge`
        );

        expect(res.status).toBe(401);
      });

      it('403 — rejects an OPERATOR', async () => {
        const res = await request(app)
          .delete(`/api/devices/${GHOST_ID}/purge`)
          .set('Authorization', `Bearer ${operatorToken}`);

        expect(res.status).toBe(403);
      });

      it('404 — unknown id', async () => {
        const res = await request(app)
          .delete(`/api/devices/${GHOST_ID}/purge`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(404);
      });

      it('400 — rejects a malformed id', async () => {
        const res = await request(app)
          .delete(`/api/devices/${INVALID_ID}/purge`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
      });
    });
  });
});
