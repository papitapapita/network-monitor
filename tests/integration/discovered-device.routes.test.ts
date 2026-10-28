// Source: src/presentation/http/routes/discovered-device.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanDatabase,
  GHOST_ID,
  INVALID_ID,
  seedDevice,
  seedWirelessDeviceModel
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { seedDiscoveredDevice } from './helpers/discoveredDevices';
import { DependencyContainer } from '../../src/infrastructure/di/container';

const BASE = '/api/network/discovered';

describe('Discovered Device Routes — /api/network/discovered', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adminToken: string;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
  });

  describe('GET /', () => {
    it('401 — without a token', async () => {
      const res = await request(app).get(BASE);

      expect(res.status).toBe(401);
    });

    it('200 — a VIEWER sees the pending suggestions', async () => {
      const id = await seedDiscoveredDevice(prisma, {
        lastSeenAt: new Date('2026-11-01T09:00:00Z')
      });
      await seedDiscoveredDevice(prisma, {
        macAddress: 'AA:BB:CC:DD:EE:02',
        ipAddress: '10.0.0.2',
        ignoredAt: new Date()
      });
      const viewer = await seedAndGetToken(app, prisma, 'VIEWER');

      const res = await request(app)
        .get(BASE)
        .set('Authorization', `Bearer ${viewer}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: [
          {
            id,
            macAddress: 'AA:BB:CC:DD:EE:01',
            ipAddress: '192.168.1.20',
            manufacturer: 'Ubiquiti Inc',
            source: 'SCAN',
            segment: '192.168.1.0/24',
            hostname: null,
            model: null,
            accessPointId: null,
            accessPointName: null,
            firstSeenAt: '2026-11-01T09:00:00.000Z',
            lastSeenAt: '2026-11-01T09:00:00.000Z',
            ignoredAt: null
          }
        ]
      });
    });

    it('200 — ?ignored=true lists the ignored ones', async () => {
      await seedDiscoveredDevice(prisma);
      const ignored = await seedDiscoveredDevice(prisma, {
        macAddress: 'AA:BB:CC:DD:EE:02',
        ipAddress: '10.0.0.2',
        ignoredAt: new Date()
      });

      const res = await request(app)
        .get(`${BASE}?ignored=true`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.map((d: { id: string }) => d.id)).toEqual([
        ignored
      ]);
    });

    it('200 — a station names the AP it was seen on', async () => {
      const modelId = await seedWirelessDeviceModel(prisma);
      const apId = await seedDevice(prisma, modelId, {
        name: 'AP Norte'
      });
      await seedDiscoveredDevice(prisma, {
        accessPointId: apId,
        hostname: 'Cliente Perez',
        model: 'LiteBeam 5AC'
      });

      const res = await request(app)
        .get(BASE)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0]).toMatchObject({
        source: 'AP_STATION',
        segment: null,
        hostname: 'Cliente Perez',
        model: 'LiteBeam 5AC',
        accessPointId: apId,
        accessPointName: 'AP Norte'
      });
    });

    it('400 — ignored must be true or false', async () => {
      const res = await request(app)
        .get(`${BASE}?ignored=yes`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  describe('GET /:id/prefill', () => {
    it('401 — without a token', async () => {
      const id = await seedDiscoveredDevice(prisma);

      const res = await request(app).get(`${BASE}/${id}/prefill`);

      expect(res.status).toBe(401);
    });

    it('200 — a VIEWER gets the create form filled from the sighting', async () => {
      const modelId = await seedWirelessDeviceModel(prisma);
      const apId = await seedDevice(prisma, modelId, {
        name: 'AP Norte'
      });
      const id = await seedDiscoveredDevice(prisma, {
        accessPointId: apId,
        hostname: 'Cliente Perez',
        model: 'LiteBeam-5AC'
      });
      const viewer = await seedAndGetToken(app, prisma, 'VIEWER');

      const res = await request(app)
        .get(`${BASE}/${id}/prefill`)
        .set('Authorization', `Bearer ${viewer}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          name: 'Cliente Perez',
          macAddress: 'AA:BB:CC:DD:EE:01',
          ipAddress: '192.168.1.20',
          deviceModelId: modelId,
          deviceModelName: 'LiteBeam 5AC',
          category: 'WIRELESS_CPE',
          upstreamDeviceId: apId,
          agentId: null
        }
      });
    });

    it('400 — a malformed id', async () => {
      const res = await request(app)
        .get(`${BASE}/${INVALID_ID}/prefill`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('404 — an unknown id', async () => {
      const res = await request(app)
        .get(`${BASE}/${GHOST_ID}/prefill`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Discovered device not found');
    });
  });

  describe.each([
    ['POST', 'ignore', null, expect.any(String)],
    ['DELETE', 'unignore', new Date('2026-10-01T00:00:00Z'), null]
  ] as const)(
    '%s /:id/ignore (%s)',
    (method, _name, startIgnored, after) => {
      const call = (id: string, token?: string) => {
        const req =
          method === 'POST'
            ? request(app).post(`${BASE}/${id}/ignore`)
            : request(app).delete(`${BASE}/${id}/ignore`);
        return token
          ? req.set('Authorization', `Bearer ${token}`)
          : req;
      };

      it('401 — without a token', async () => {
        const id = await seedDiscoveredDevice(prisma);

        const res = await call(id);

        expect(res.status).toBe(401);
      });

      it('403 — a VIEWER cannot decide', async () => {
        const id = await seedDiscoveredDevice(prisma);
        const viewer = await seedAndGetToken(app, prisma, 'VIEWER');

        const res = await call(id, viewer);

        expect(res.status).toBe(403);
      });

      it('200 — an OPERATOR changes it', async () => {
        const id = await seedDiscoveredDevice(prisma, {
          ignoredAt: startIgnored
        });
        const operator = await seedAndGetToken(
          app,
          prisma,
          'OPERATOR'
        );

        const res = await call(id, operator);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({ id, ignoredAt: after });
      });

      it('400 — a malformed id', async () => {
        const res = await call(INVALID_ID, adminToken);

        expect(res.status).toBe(400);
      });

      it('404 — an unknown id', async () => {
        const res = await call(GHOST_ID, adminToken);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({
          success: false,
          error: 'Discovered device not found'
        });
      });
    }
  );
});
